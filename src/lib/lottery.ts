import {
  collection, getDocs, doc, setDoc, getDoc, updateDoc, writeBatch,
  query, where, orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Types ───

export interface Milestone {
  id: string;
  target: number;
  label: string;
  prize1: string;
  prize2: string;
  minPoints: number;
  status: "pending" | "reached" | "drawn" | "awarded";
  reachedAt?: Date;
  drawnAt?: Date;
  seed?: number;
  winner1Id?: string; // #1 ranking.
  winner1Points?: number;
  winner2Id?: string; // Lottery winner.
  winner2Points?: number;
  winner2Tickets?: number;
  totalTickets?: number;
  totalParticipants?: number;
}

export interface LotteryParticipant {
  userId: string;
  points: number;
  tickets: number; // = points (all points count as tickets).
}

// ─── Milestone definitions ───

export const MILESTONE_DEFS = [
  { target: 1000, label: "1K", prize1: "3 meses Premium", prize2: "3 meses Premium", minPoints: 500 },
  { target: 5000, label: "5K", prize1: "6 meses Premium", prize2: "6 meses Premium", minPoints: 1000 },
  { target: 10000, label: "10K", prize1: "1 año Premium + merchandising", prize2: "1 año Premium", minPoints: 2000 },
  { target: 25000, label: "25K", prize1: "1 año + cena presencial con autor", prize2: "Cena presencial", minPoints: 3000 },
  { target: 50000, label: "50K", prize1: "iPhone + comida presencial", prize2: "iPhone + comida presencial", minPoints: 5000 },
  { target: 100000, label: "100K", prize1: "Viaje 15 días escenarios del libro", prize2: "Viaje 15 días", minPoints: 8000 },
];

// ─── Functions ───

/** Initialize milestones in Firestore if they don't exist. */
export async function initMilestones() {
  for (const def of MILESTONE_DEFS) {
    const ref = doc(db, "milestones", `milestone_${def.target}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...def,
        id: `milestone_${def.target}`,
        status: "pending",
        createdAt: Timestamp.now(),
      });
    }
  }
}

/** Get all milestones. */
export async function getMilestones(): Promise<Milestone[]> {
  const snap = await getDocs(query(collection(db, "milestones"), orderBy("target")));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      target: data.target,
      label: data.label,
      prize1: data.prize1,
      prize2: data.prize2,
      minPoints: data.minPoints ?? 0,
      status: data.status ?? "pending",
      reachedAt: data.reachedAt?.toDate(),
      drawnAt: data.drawnAt?.toDate(),
      seed: data.seed,
      winner1Id: data.winner1Id,
      winner1Points: data.winner1Points,
      winner2Id: data.winner2Id,
      winner2Points: data.winner2Points,
      winner2Tickets: data.winner2Tickets,
      totalTickets: data.totalTickets,
      totalParticipants: data.totalParticipants,
    };
  });
}

/** Mark a milestone as reached. */
export async function markMilestoneReached(milestoneId: string) {
  await updateDoc(doc(db, "milestones", milestoneId), {
    status: "reached",
    reachedAt: Timestamp.now(),
  });
}

/** Get lottery participants for a milestone (users above minPoints). */
export async function getLotteryParticipants(minPoints: number): Promise<LotteryParticipant[]> {
  const snap = await getDocs(
    query(collection(db, "user_points"), where("currentMilestonePoints", ">=", minPoints))
  );
  return snap.docs
    .map((d) => {
      const pts = d.data().currentMilestonePoints ?? 0;
      return {
        userId: d.id,
        points: pts,
        tickets: pts, // All points = tickets.
      };
    })
    .sort((a, b) => b.points - a.points);
}

/**
 * Execute the lottery for a milestone.
 *
 * - #1 by ranking wins automatically.
 * - Among the rest (above minPoints), weighted random by points.
 * - Uses the milestone reached timestamp as seed for reproducibility.
 */
export async function executeLottery(milestoneId: string): Promise<{
  winner1: LotteryParticipant;
  winner2: LotteryParticipant;
  seed: number;
  totalTickets: number;
  totalParticipants: number;
} | null> {
  const msRef = doc(db, "milestones", milestoneId);
  const msSnap = await getDoc(msRef);
  if (!msSnap.exists()) return null;

  const msData = msSnap.data();
  const minPoints = msData.minPoints ?? 0;

  // Get all participants.
  const participants = await getLotteryParticipants(minPoints);
  if (participants.length < 2) return null;

  // #1 by ranking.
  const winner1 = participants[0];

  // Remove #1 from lottery pool.
  const pool = participants.slice(1);

  // Weighted random selection.
  const totalTickets = pool.reduce((sum, p) => sum + p.tickets, 0);
  const seed = msData.reachedAt?.toMillis() ?? Date.now();

  // Deterministic random from seed.
  const randomValue = seededRandom(seed) * totalTickets;

  let cumulative = 0;
  let winner2 = pool[0];
  for (const p of pool) {
    cumulative += p.tickets;
    if (randomValue < cumulative) {
      winner2 = p;
      break;
    }
  }

  // Save results.
  await updateDoc(msRef, {
    status: "drawn",
    drawnAt: Timestamp.now(),
    seed,
    winner1Id: winner1.userId,
    winner1Points: winner1.points,
    winner2Id: winner2.userId,
    winner2Points: winner2.points,
    winner2Tickets: winner2.tickets,
    totalTickets,
    totalParticipants: participants.length,
  });

  return { winner1, winner2, seed, totalTickets, totalParticipants: participants.length };
}

/** Reset all user points for the new milestone period. */
export async function resetAllPoints() {
  const snap = await getDocs(collection(db, "user_points"));
  const batch = writeBatch(db);

  for (const userDoc of snap.docs) {
    batch.update(userDoc.ref, {
      currentMilestonePoints: 0,
    });
  }

  await batch.commit();
}

/** Mark milestone as fully awarded and reset points. */
export async function finalizeMilestone(milestoneId: string) {
  await updateDoc(doc(db, "milestones", milestoneId), {
    status: "awarded",
  });
  await resetAllPoints();
}

/**
 * Simple seeded random number generator (mulberry32).
 * Returns a number between 0 and 1.
 */
function seededRandom(seed: number): number {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

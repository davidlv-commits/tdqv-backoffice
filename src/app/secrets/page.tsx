"use client";

import { useEffect, useState, useRef } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { collection, getDocs, addDoc, setDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadFile } from "@/lib/upload";

interface Secret {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  order: number;
  active: boolean;
}

async function getSecrets(): Promise<Secret[]> {
  const snap = await getDocs(collection(db, "secrets"));
  const secrets = snap.docs.map(d => ({ id: d.id, ...d.data() } as Secret));
  return secrets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function saveSecret(secret: Partial<Secret> & { id: string }) {
  const { id, ...data } = secret;
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  await setDoc(doc(db, "secrets", id), { ...clean, updatedAt: Timestamp.now() }, { merge: true });
}

async function addSecret(secret: Omit<Secret, "id">) {
  const clean = Object.fromEntries(Object.entries(secret).filter(([, v]) => v !== undefined));
  return addDoc(collection(db, "secrets"), { ...clean, createdAt: Timestamp.now() });
}

async function removeSecret(id: string) {
  await deleteDoc(doc(db, "secrets", id));
}

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Secret>>({});
  const [saving, setSaving] = useState(false);
  const [newSecret, setNewSecret] = useState({ title: "", body: "", imageUrl: "", order: 0, active: true });

  // Image upload
  const newImageRef = useRef<HTMLInputElement>(null);
  const editImageRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    getSecrets().then(s => { setSecrets(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleImageUpload = async (file: File, target: "new" | "edit") => {
    setUploadingImage(true);
    try {
      const url = await uploadFile(file, `secrets/${Date.now()}-${file.name}`);
      if (target === "new") {
        setNewSecret(p => ({ ...p, imageUrl: url }));
      } else {
        setEditData(p => ({ ...p, imageUrl: url }));
      }
    } catch (e) {
      console.error("Error uploading image:", e);
    }
    setUploadingImage(false);
  };

  const handleCreate = async () => {
    if (!newSecret.title) return;
    setSaving(true);
    try {
      await addSecret({
        title: newSecret.title,
        body: newSecret.body,
        imageUrl: newSecret.imageUrl || undefined,
        order: newSecret.order || secrets.length + 1,
        active: newSecret.active,
      });
      const updated = await getSecrets();
      setSecrets(updated);
      setShowForm(false);
      setNewSecret({ title: "", body: "", imageUrl: "", order: 0, active: true });
    } catch (e) {
      console.error("Error:", e);
      alert("Error al guardar");
    }
    setSaving(false);
  };

  const handleSave = async () => {
    if (!expandedId) return;
    setSaving(true);
    try {
      await saveSecret({ id: expandedId, ...editData } as Partial<Secret> & { id: string });
      setSecrets(prev => prev.map(s => s.id === expandedId ? { ...s, ...editData } : s));
      setExpandedId(null);
    } catch (e) {
      console.error("Error:", e);
      alert("Error al guardar");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este secreto?")) return;
    await removeSecret(id);
    setSecrets(prev => prev.filter(s => s.id !== id));
  };

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">Los secretos de esta historia</h2>
              <p className="text-sm text-zinc-500 mt-1">
                Contenido exclusivo que se desbloquea al completar los dos libros
              </p>
            </div>
            <Button
              onClick={() => { setShowForm(!showForm); setNewSecret({ title: "", body: "", imageUrl: "", order: secrets.length + 1, active: true }); }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {showForm ? "Cancelar" : "+ Nuevo secreto"}
            </Button>
          </div>

          {/* Info banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800">
              <strong>Blog secreto:</strong> Los secretos se desbloquean cuando el lector completa ambos libros.
              Crea entradas con titulo, texto e imagen opcional — como un blog privado con contenido exclusivo
              que premia a los lectores mas fieles.
            </p>
          </div>

          {/* New secret form */}
          {showForm && (
            <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm mb-6 space-y-4">
              <h3 className="font-semibold text-zinc-900">Nuevo secreto</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-zinc-500">Titulo</Label>
                  <Input value={newSecret.title} onChange={e => setNewSecret(p => ({ ...p, title: e.target.value }))}
                    className="bg-white border-zinc-300 text-zinc-900" placeholder="La verdadera historia..." />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Orden</Label>
                  <Input type="number" value={newSecret.order} onChange={e => setNewSecret(p => ({ ...p, order: Number(e.target.value) }))}
                    className="bg-white border-zinc-300 text-zinc-900" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Contenido</Label>
                <Textarea value={newSecret.body} onChange={e => setNewSecret(p => ({ ...p, body: e.target.value }))}
                  className="bg-white border-zinc-300 text-zinc-900 min-h-[120px]"
                  placeholder="El contenido del secreto..." />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Imagen (opcional)</Label>
                <input ref={newImageRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "new"); }} />
                <div className="flex items-center gap-3 mt-1">
                  {newSecret.imageUrl && (
                    <img src={newSecret.imageUrl} alt="" className="w-20 h-14 rounded-lg object-cover border border-zinc-200" />
                  )}
                  <Button variant="outline" size="sm" onClick={() => newImageRef.current?.click()}
                    disabled={uploadingImage} className="text-xs">
                    {uploadingImage ? "Subiendo..." : newSecret.imageUrl ? "Cambiar imagen" : "Subir imagen"}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={saving || !newSecret.title}
                  className="bg-amber-600 hover:bg-amber-700 text-white">
                  {saving ? "Guardando..." : "Crear secreto"}
                </Button>
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Secrets list */}
          {loading ? <p className="text-zinc-500">Cargando...</p> : secrets.length === 0 && !showForm ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center shadow-sm">
              <p className="text-4xl mb-4">🔐</p>
              <p className="text-zinc-600 font-medium mb-2">No hay secretos todavia</p>
              <p className="text-sm text-zinc-400">Añade contenido exclusivo que los lectores desbloquean al completar ambos libros</p>
            </div>
          ) : (
            <div className="space-y-2">
              {secrets.map(s => (
                <div key={s.id}>
                  <div
                    onClick={() => { setExpandedId(expandedId === s.id ? null : s.id); setEditData(s); }}
                    className={`flex items-center gap-4 bg-white border rounded-lg px-4 py-3 cursor-pointer transition-all ${
                      expandedId === s.id ? "border-amber-500/50 rounded-b-none shadow-sm" : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    {s.imageUrl && (
                      <img src={s.imageUrl} alt="" className="w-16 h-12 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900 truncate">{s.title}</p>
                      <p className="text-xs text-zinc-500 truncate">{s.body.substring(0, 80)}{s.body.length > 80 ? "..." : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className="bg-zinc-100 text-zinc-500 text-xs">#{s.order}</Badge>
                      {s.active ? <Badge className="bg-green-100 text-green-700">Activo</Badge>
                        : <Badge className="bg-zinc-100 text-zinc-500">Inactivo</Badge>}
                      <button onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
                        className="text-zinc-400 hover:text-red-500 text-sm">Eliminar</button>
                    </div>
                  </div>

                  {/* Edit form */}
                  {expandedId === s.id && (
                    <div className="bg-zinc-50 border border-zinc-200 border-t-0 rounded-b-lg p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-zinc-500">Titulo</Label>
                          <Input value={editData.title || ""} onChange={e => setEditData(p => ({ ...p, title: e.target.value }))}
                            className="bg-white border-zinc-300 text-zinc-900" />
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-500">Orden</Label>
                          <Input type="number" value={editData.order ?? 0} onChange={e => setEditData(p => ({ ...p, order: Number(e.target.value) }))}
                            className="bg-white border-zinc-300 text-zinc-900" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">Contenido</Label>
                        <Textarea value={editData.body || ""} onChange={e => setEditData(p => ({ ...p, body: e.target.value }))}
                          className="bg-white border-zinc-300 text-zinc-900 min-h-[120px]" />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">Imagen</Label>
                        <input ref={editImageRef} type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "edit"); }} />
                        <div className="flex items-center gap-3 mt-1">
                          {editData.imageUrl && (
                            <img src={editData.imageUrl} alt="" className="w-20 h-14 rounded-lg object-cover border border-zinc-200" />
                          )}
                          <Button variant="outline" size="sm" onClick={() => editImageRef.current?.click()}
                            disabled={uploadingImage} className="text-xs">
                            {uploadingImage ? "Subiendo..." : editData.imageUrl ? "Cambiar" : "Subir imagen"}
                          </Button>
                          {editData.imageUrl && (
                            <Button variant="ghost" size="sm" onClick={() => setEditData(p => ({ ...p, imageUrl: "" }))}
                              className="text-xs text-red-500">Quitar</Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">Activo</span>
                          <Switch checked={editData.active ?? true} onCheckedChange={v => setEditData(p => ({ ...p, active: v }))} />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSave} disabled={saving}
                          className="bg-amber-600 hover:bg-amber-700 text-white">
                          {saving ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button variant="ghost" onClick={() => setExpandedId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

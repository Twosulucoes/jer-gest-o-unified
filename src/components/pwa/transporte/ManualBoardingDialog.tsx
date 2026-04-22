import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPwaMessage, getPwaLang } from "@/lib/pwa-messages";

interface ManualBoardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  onSuccess: () => void;
}

export function ManualBoardingDialog({
  open,
  onOpenChange,
  tripId,
  onSuccess,
}: ManualBoardingDialogProps) {
  const lang = getPwaLang();
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setCpf("");
    setPhoto(null);
    setPhotoPreview(null);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(getPwaMessage("ERR_NAME_REQUIRED", lang));
      return;
    }
    setSaving(true);
    try {
      let photoUrl: string | null = null;

      if (photo) {
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `${tripId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("transport-passenger-docs")
          .upload(path, photo, { contentType: photo.type });
        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage
          .from("transport-passenger-docs")
          .getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await supabase.from("transport_passengers").insert({
        trip_id: tripId,
        participant_id: null,
        status: "boarded",
        boarded_at: new Date().toISOString(),
        boarded_by: session?.user.id ?? null,
        is_manual: true,
        manual_name: name.trim(),
        manual_cpf: cpf.trim() || null,
        identity_photo_url: photoUrl,
      } as any);

      if (error) throw error;

      toast.success(`${name.trim()} ${getPwaMessage("SUCCESS_BOARDING", lang)} (${getPwaMessage("MANUAL_SEARCH", lang)})`);
      if (navigator.vibrate) navigator.vibrate(200);
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(`${getPwaMessage("ERR_UNKNOWN", lang)}: ` + (err.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{getPwaMessage("MANUAL_BOARDING", lang)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm">{getPwaMessage("FULL_NAME", lang)} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={getPwaMessage("PASSENGER_NAME_PLACEHOLDER", lang)} />
          </div>

          <div className="space-y-1">
            <Label className="text-sm">CPF (opcional)</Label>
            <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Foto do documento</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Documento" className="w-full rounded-lg border max-h-40 object-cover" />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                <Camera className="h-4 w-4 mr-2" /> Tirar foto do documento
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Salvando..." : "Registrar Embarque"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useUIContext } from "@/contexts/UIContext";
import { useAuthContext } from "@/contexts/AuthContext";

export default function ProfileUpdateDialog() {
  const { isProfileUpdateOpen, setIsProfileUpdateOpen } = useUIContext();
  const { user, handleUpdateProfile } = useAuthContext();
  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.name) {
      setNewName(user.name);
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    const success = await handleUpdateProfile(newName);
    setIsSubmitting(false);
    if (success) {
      setIsProfileUpdateOpen(false);
    }
  };

  return (
    <Dialog open={isProfileUpdateOpen} onOpenChange={setIsProfileUpdateOpen}>
      <DialogContent className="rounded-3xl border-gray-100 shadow-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Update Profile</DialogTitle>
          <DialogDescription className="text-xs font-medium text-gray-500">
            Change your display name below.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Full Name"
            className="rounded-2xl border-gray-100 focus:ring-1 focus:ring-black h-12 px-4 font-medium"
            disabled={isSubmitting}
          />
        </div>
        <DialogFooter className="flex gap-2">
          <Button 
            onClick={handleSubmit} 
            className="rounded-xl flex-1 font-semibold text-sm bg-black text-white px-8"
            disabled={isSubmitting || !newName.trim()}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

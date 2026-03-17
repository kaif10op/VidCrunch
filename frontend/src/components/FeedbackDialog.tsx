import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useUIContext } from "@/contexts/UIContext";
import { useAuthContext } from "@/contexts/AuthContext";

export default function FeedbackDialog() {
  const { isFeedbackOpen, setIsFeedbackOpen } = useUIContext();
  const { submitFeedback } = useAuthContext();
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!feedbackText.trim()) return;
    setIsSubmitting(true);
    const success = await submitFeedback(feedbackText);
    setIsSubmitting(false);
    if (success) {
      setFeedbackText("");
      setIsFeedbackOpen(false);
    }
  };

  return (
    <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
      <DialogContent className="rounded-3xl border-gray-100 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Send Feedback</DialogTitle>
          <DialogDescription className="text-sm font-medium text-gray-500">
            Help us improve TubeBrain. What's on your mind?
          </DialogDescription>
        </DialogHeader>
        <Textarea 
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="I love the synthesis mode but..." 
          className="min-h-[120px] rounded-2xl border-gray-100 focus:ring-1 focus:ring-black"
          disabled={isSubmitting}
        />
        <DialogFooter>
          <Button 
            onClick={handleSubmit} 
            className="rounded-xl font-semibold text-sm h-10 px-6 bg-black text-white"
            disabled={isSubmitting || !feedbackText.trim()}
          >
            {isSubmitting ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

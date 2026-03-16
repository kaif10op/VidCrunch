import { Coins } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUIContext } from "@/contexts/UIContext";
import { useAuthContext } from "@/contexts/AuthContext";

export default function TopUpDialog() {
  const { isTopUpOpen, setIsTopUpOpen } = useUIContext();
  const { handlePayment } = useAuthContext();

  const onSelectPlan = async (plan: string) => {
    const success = await handlePayment(plan);
    if (success) {
      setIsTopUpOpen(false);
    }
  };

  return (
    <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
      <DialogContent className="rounded-[2.5rem] border-gray-100 shadow-2xl max-w-2xl p-0 overflow-hidden bg-white">
        <DialogTitle className="sr-only">Top Up Credits</DialogTitle>
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-8 md:p-10 bg-gray-50/50 border-r border-gray-100">
             <div className="flex items-center gap-2 mb-6 text-black">
               <div className="p-2 bg-black rounded-xl">
                 <Coins className="h-5 w-5 text-white" />
               </div>
               <span className="text-sm font-bold">Top Up Credits</span>
             </div>
             <h2 className="text-3xl font-bold tracking-tight leading-none mb-4">Fuel Your Learning.</h2>
             <p className="text-sm font-medium text-gray-500 mb-8 max-w-[240px]">Get access to more deep-dives, podcast synthesis, and advanced AI models.</p>
             
             <div className="space-y-4">
                <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                  <div className="h-1 w-1 rounded-full bg-black" />
                  Unlimited Transcript Extraction
                </div>
                <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                  <div className="h-1 w-1 rounded-full bg-black" />
                  Advanced AI Reasoning Models
                </div>
                <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                  <div className="h-1 w-1 rounded-full bg-black" />
                  Export to PDF, MD, & Notion
                </div>
             </div>
          </div>

          <div className="p-8 md:p-10 space-y-6">
             <button 
               onClick={() => onSelectPlan("starter")}
               className="w-full group relative p-6 bg-white border border-gray-100 rounded-[2rem] text-left hover:border-black hover:shadow-xl transition-all"
             >
               <div className="flex justify-between items-start mb-2">
                 <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 group-hover:text-black">Starter</span>
                 <span className="text-2xl font-bold">₹499</span>
               </div>
               <h3 className="text-xl font-bold mb-1">500 Credits</h3>
               <p className="text-[10px] font-bold text-gray-400 group-hover:text-gray-500 transition-colors">Perfect for occasional researchers.</p>
             </button>

             <button 
               onClick={() => onSelectPlan("pro")}
               className="w-full group relative p-6 bg-black text-white border border-black rounded-[2rem] text-left hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] transition-all overflow-hidden"
             >
               <div className="absolute top-4 right-4 px-2 py-0.5 bg-white/20 rounded-full text-[9px] font-semibold uppercase backdrop-blur-md">Best Value</div>
               <div className="flex justify-between items-start mb-2">
                 <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Pro Miner</span>
                 <span className="text-2xl font-bold">₹1499</span>
               </div>
               <h3 className="text-xl font-bold mb-1">2000 Credits</h3>
               <p className="text-[10px] font-bold text-white/40 group-hover:text-white/60 transition-colors">For serious learners and power users.</p>
             </button>
             <p className="text-[10px] font-medium text-center text-gray-400 px-4">Secure payment via Razorpay. Credits expire 12 months from purchase.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

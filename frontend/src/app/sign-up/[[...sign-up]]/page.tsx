import { SignUp } from "@clerk/nextjs";
import { Scale } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative px-4">
      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full -z-10" />
      
      <div className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
          <Scale className="h-8 w-8" />
        </div>
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight">BD Legal AI</h1>
          <p className="text-xs text-slate-400">Bangladesh Legal Research Platform</p>
        </div>
      </div>

      <SignUp 
        path="/sign-up" 
        routing="path" 
        signInUrl="/sign-in" 
      />
    </div>
  );
}

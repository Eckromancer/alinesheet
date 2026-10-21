import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import Review from "./pages/Review";
import FinalReview from "./pages/FinalReview";
import Confirmation from "./pages/Confirmation";
import Portal from "./pages/Portal";
import ManagerDashboard from "./pages/ManagerDashboard";
import ManagerHome from "./pages/ManagerHome";
import Manager from "./pages/Manager";
import Governance from "./pages/Governance";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import EmailGate from "./components/EmailGate";
import RequireRole from "./components/RequireRole";
import SignIn from "./pages/SignIn";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <EmailGate>
          <Routes>
            <Route path="/" element={<RequireRole role="dsa"><Login /></RequireRole>} />
            <Route path="/review" element={<RequireRole role="dsa"><Review /></RequireRole>} />
            <Route path="/final" element={<RequireRole role="dsa"><FinalReview /></RequireRole>} />
            <Route path="/confirmation" element={<RequireRole role="dsa"><Confirmation /></RequireRole>} />
            <Route path="/portal" element={<Portal />} />
            <Route path="/manager" element={<RequireRole role="buyer"><ManagerDashboard /></RequireRole>} />
            <Route path="/manager/home" element={<RequireRole role="buyer"><ManagerHome /></RequireRole>} />
            <Route path="/manager/submissions" element={<RequireRole role="buyer"><Manager /></RequireRole>} />
            <Route path="/manager/governance" element={<RequireRole role="buyer"><Governance /></RequireRole>} />
            <Route path="/manager/reports" element={<RequireRole role="buyer"><Reports /></RequireRole>} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </EmailGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

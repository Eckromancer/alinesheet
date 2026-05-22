import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import Review from "./pages/Review";
import FinalReview from "./pages/FinalReview";
import Confirmation from "./pages/Confirmation";
import Admin from "./pages/Admin";
import Portal from "./pages/Portal";
import ManagerDashboard from "./pages/ManagerDashboard";
import ManagerHome from "./pages/ManagerHome";
import Manager from "./pages/Manager";
import Governance from "./pages/Governance";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import EmailGate from "./components/EmailGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <EmailGate>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/review" element={<Review />} />
            <Route path="/final" element={<FinalReview />} />
            <Route path="/confirmation" element={<Confirmation />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/portal" element={<Portal />} />
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/manager/home" element={<ManagerHome />} />
            <Route path="/manager/submissions" element={<Manager />} />
            <Route path="/manager/governance" element={<Governance />} />
            <Route path="/manager/reports" element={<Reports />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </EmailGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

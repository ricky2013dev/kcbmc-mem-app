import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import FamilyFormPage from "@/pages/family-form";
import StaffManagementPage from "@/pages/staff-management";
import NewsManagementPage from "@/pages/news-management";
import EventListPage from "@/pages/event-list";
import EventDetailPage from "@/pages/event-detail";
import EventFormPage from "@/pages/event-form";
import PublicAnnouncementPage from "@/pages/public-announcement";
import DepartmentManagementPage from "@/pages/department-management";
import TeamManagementPage from "@/pages/team-management";
import TeamDashboardPage from "@/pages/team-dashboard";
import FamilyTeamDashboardPage from "@/pages/family-team-dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Switch>
        {/* Public routes (no authentication required) */}
        <Route path="/announcement/:id" component={PublicAnnouncementPage} />
        
        {!isAuthenticated ? (
          <Route path="/" component={LoginPage} />
        ) : (
          <>
            <Route path="/" component={DashboardPage} />
            <Route path="/family/new" component={() => <FamilyFormPage mode="create" />} />
            <Route path="/family/:id/edit" component={({ params }) => <FamilyFormPage mode="edit" familyId={params.id} />} />
            <Route path="/staff-management" component={StaffManagementPage} />
            <Route path="/news-management" component={NewsManagementPage} />
            <Route path="/events" component={EventListPage} />
            <Route path="/events/new" component={() => <EventFormPage mode="create" />} />
            <Route path="/events/:id" component={EventDetailPage} />
            <Route path="/events/:id/edit" component={({ params }) => <EventFormPage mode="edit" eventId={params.id} />} />
            <Route path="/departments" component={DepartmentManagementPage} />
            <Route path="/teams" component={TeamManagementPage} />
            <Route path="/team-dashboard" component={TeamDashboardPage} />
            <Route path="/family-dashboard" component={FamilyTeamDashboardPage} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

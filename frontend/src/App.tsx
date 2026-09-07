import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import DashboardLayout from "./layouts/DashboardLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ReviewQueue from "./pages/ReviewQueue";
import ApplicationReview from "./pages/ApplicationReview";
import BiasAlerts from "./pages/BiasAlerts";
import Reminders from "./pages/Reminders";
import Notifications from "./pages/Notifications";
import GovernanceAnalysis from "./pages/GovernanceAnalysis";
import Policies from "./pages/Policies";
import FairnessBias from "./pages/FairnessBias";
import Configuration from "./pages/Configuration";
import AuditTrail from "./pages/AuditTrail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<DashboardLayout />}>
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/reviews"
            element={<ReviewQueue />}
          />

          <Route
            path="/reviews/:id"
            element={<ApplicationReview />}
          />

          <Route
            path="/alerts"
            element={<BiasAlerts />}
          />

          <Route
            path="/reminders"
            element={<Reminders />}
          />

          <Route
            path="/notifications"
            element={<Notifications />}
          />
          </Route>

          <Route
            path="/reviews/:id"
            element={<GovernanceAnalysis />}
          />

          <Route
            path="/policies"
            element={<Policies />}
          />

          <Route
            path="/fairness"
            element={<FairnessBias />}
          />

          <Route
            path="/configuration"
            element={<Configuration />}
          />

          <Route
            path="/audit"
            element={<AuditTrail />}
          />

          <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
          />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


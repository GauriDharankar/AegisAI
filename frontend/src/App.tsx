import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import DashboardLayout from "./layouts/DashboardLayout";

import Login from "./pages/Login";
import Unauthorized from "./pages/Unauthorized";

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

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =========================
            PUBLIC ROUTES
        ========================== */}

        <Route path="/login" element={<Login />} />

        <Route
          path="/unauthorized"
          element={<Unauthorized />}
        />


        {/* =========================
            PROTECTED APPLICATION
        ========================== */}

        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >

          {/* Dashboard */}
          <Route
            path="dashboard"
            element={<Dashboard />}
          />


          {/* Decision Queue */}
          <Route
            path="reviews"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "OPERATIONS",
                  "RISK_OFFICER",
                  "CREDIT_COMMITTEE",
                  "MANAGER",
                ]}
              >
                <ReviewQueue />
              </ProtectedRoute>
            }
          />


          {/* Individual Application Review */}
          <Route
            path="reviews/:id"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "OPERATIONS",
                  "RISK_OFFICER",
                  "CREDIT_COMMITTEE",
                  "MANAGER",
                ]}
              >
                <ApplicationReview />
              </ProtectedRoute>
            }
          />


          {/* Governance Analysis */}
          <Route
            path="governance/:id"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "RISK_OFFICER",
                  "CREDIT_COMMITTEE",
                  "MANAGER",
                ]}
              >
                <GovernanceAnalysis />
              </ProtectedRoute>
            }
          />


          {/* Bias Alerts */}
          <Route
            path="alerts"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "RISK_OFFICER",
                  "MANAGER",
                ]}
              >
                <BiasAlerts />
              </ProtectedRoute>
            }
          />


          {/* Reminders */}
          <Route
            path="reminders"
            element={<Reminders />}
          />


          {/* Notifications */}
          <Route
            path="notifications"
            element={<Notifications />}
          />


          {/* Policies */}
          <Route
            path="policies"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "RISK_OFFICER",
                  "MANAGER",
                ]}
              >
                <Policies />
              </ProtectedRoute>
            }
          />


          {/* Fairness & Bias */}
          <Route
            path="fairness"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "RISK_OFFICER",
                  "MANAGER",
                ]}
              >
                <FairnessBias />
              </ProtectedRoute>
            }
          />


          {/* Audit Trail */}
          <Route
            path="audit"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "CREDIT_COMMITTEE",
                  "MANAGER",
                ]}
              >
                <AuditTrail />
              </ProtectedRoute>
            }
          />


          {/* Configuration */}
          <Route
            path="configuration"
            element={
              <ProtectedRoute
                allowedRoles={["MANAGER"]}
              >
                <Configuration />
              </ProtectedRoute>
            }
          />

        </Route>


        {/* =========================
            DEFAULT ROUTES
        ========================== */}

        <Route
          path="/"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
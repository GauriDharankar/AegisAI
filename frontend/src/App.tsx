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
          path="/"
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


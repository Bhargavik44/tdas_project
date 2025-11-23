import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./components/LoginPage/LoginPage";
import DriverDashboard from "./components/DriverDashboard/DriverDashboard";
import AdminDashboard from "./components/AdminDashboard/AdminDashboard";
import SubscriberDashboard from "./components/SubscriberDashboard/SubscriberDashboard";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/driver-dashboard" element={<DriverDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/subscriber-dashboard" element={<SubscriberDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
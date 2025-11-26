import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../utils/api";
import "./SubscriberDashboard.css";

function SubscriberDashboard() {
  const navigate = useNavigate();
  const [mobileNo, setMobileNo] = useState("");
  const [name, setName] = useState("");
  const [routeID, setRouteID] = useState("");
  const [stopID, setStopID] = useState("");

  const [originalMobile, setOriginalMobile] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [originalRoute, setOriginalRoute] = useState("");
  const [originalStop, setOriginalStop] = useState("");

  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const userID = localStorage.getItem("userID");

  // Load all routes
  useEffect(() => {
    fetch(`${API_BASE}/routes`)
      .then((r) => r.json())
      .then(setRoutes)
      .catch(console.error);
  }, []);

  // Load stops for selected route
  useEffect(() => {
    if (!routeID) {
      setStops([]);
      return;
    }
    fetch(`${API_BASE}/bus-stops/${routeID}`)
      .then((r) => r.json())
      .then(setStops)
      .catch(console.error);
  }, [routeID]);

  // Load subscriber profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!userID) return;
      try {
        const res = await fetch(`${API_BASE}/subscriber/${userID}`);
        const data = await res.json();

        setMobileNo(data.mobileNo || "");
        setName(data.name || data.username || data.fullName || "");
        setRouteID(data.routeID || "");
        setStopID(data.stopID || "");

        setOriginalMobile(data.mobileNo || "");
        setOriginalName(data.name || data.username || data.fullName || "");
        setOriginalRoute(data.routeID || "");
        setOriginalStop(data.stopID || "");
      } catch (err) {
        console.error(err);
      }
    };
    loadProfile();
  }, [userID]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEditing) return;

    try {
      const res = await fetch(`${API_BASE}/subscribers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userID: parseInt(userID, 10),
          mobileNo,
          routeID,
          stopID,
        }),
      });

      const data = await res.json();
      setStatusMsg(data.message);

      setOriginalMobile(mobileNo);
      setOriginalName(name);
      setOriginalRoute(routeID);
      setOriginalStop(stopID);

      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = () => {
    setMobileNo(originalMobile);
    setName(originalName);
    setRouteID(originalRoute);
    setStopID(originalStop);
    setIsEditing(false);
  };

  return (
    <div className="sd-container">
      <div className="sd-navbar">
        <div className="title">Subscriber Dashboard</div>
        <button className="btn-nav" onClick={() => navigate("/")}>
          Logout
        </button>
      </div>

      <div className="sd-content">
        <h2>Subscribe for Delay Alerts</h2>

        <form onSubmit={handleSubmit} className="sd-form">
          {/* MOBILE NUMBER */}
          <label className="input-label">Mobile Number</label>
          <input
            type="text"
            value={mobileNo}
            className="input-field"
            onChange={(e) => setMobileNo(e.target.value)}
            disabled={!isEditing}
            required
          />

          {/* NAME */}
          <label className="input-label">Name</label>
          <input
            type="text"
            value={name}
            className="input-field"
            onChange={(e) => setName(e.target.value)}
            disabled={!isEditing}
            required
          />

          {/* ROUTE */}
          <label className="input-label">Route Name</label>
          <select
            value={routeID}
            className="input-field"
            onChange={(e) => setRouteID(e.target.value)}
            disabled={!isEditing}
            required
          >
            <option value="">Select Route</option>
            {routes.map((r) => (
              <option key={r.routeID} value={r.routeID}>
                {r.routeName}
              </option>
            ))}
          </select>

          {/* STOP */}
          <label className="input-label">Stop Name</label>
          <select
            value={stopID}
            className="input-field"
            onChange={(e) => setStopID(e.target.value)}
            disabled={!isEditing}
            required
          >
            <option value="">Select Stop</option>
            {stops.map((s) => (
              <option key={s.stopID} value={s.stopID}>
                {s.stopName}
              </option>
            ))}
          </select>

          <div className="button-row">
            <button
              type="button"
              className={`btn edit-btn ${isEditing ? "disabled" : ""}`}
              onClick={() => setIsEditing(true)}
              disabled={isEditing}
            >
              Edit
            </button>

            <button
              type="submit"
              className={`btn save-btn ${!isEditing ? "disabled" : ""}`}
              disabled={!isEditing}
            >
              Save
            </button>

            {isEditing && (
              <button
                type="button"
                className="btn cancel-btn"
                onClick={handleCancel}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {statusMsg && <p className="status-msg">{statusMsg}</p>}
      </div>
    </div>
  );
}

export default SubscriberDashboard;
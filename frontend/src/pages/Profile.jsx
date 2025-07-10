import React from "react";

const Profile = () => {
  // In real use, fetch user info from context/localStorage/api
  // Demo static content:
  const user = { name: "Aayush Shukla", email: "aayush@email.com" };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#ECE6F7",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        background: "#fff",
        padding: "2.5rem",
        borderRadius: "12px",
        boxShadow: "0 2px 16px rgba(95,67,178,0.07)",
        width: "360px",
        textAlign: "center"
      }}>
        <h2 style={{ color: "#5F43B2", fontWeight: "bold", marginBottom: 20 }}>My Profile</h2>
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontWeight: 600, color: "#222" }}>Name: </span>{user.name}
        </div>
        <div>
          <span style={{ fontWeight: 600, color: "#222" }}>Email: </span>{user.email}
        </div>
      </div>
    </div>
  );
};

export default Profile;

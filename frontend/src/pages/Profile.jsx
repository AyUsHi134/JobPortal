import React, { useEffect, useState } from "react";
import styled from "styled-components";

const Wrapper = styled.div`
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
`;
const Card = styled.div`
  background: #fff;
  padding: 2.6rem 2.1rem 2rem 2.1rem;
  border-radius: 14px;
  box-shadow: 0 2px 28px rgba(95,67,178,0.12);
  width: 350px;
  max-width: 96vw;
  display: flex;
  flex-direction: column;
`;
export default function Profile() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch("/api/auth/profile")
      .then(res => res.json())
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  if (!user) return <Wrapper>Loading...</Wrapper>;
  return (
    <Wrapper>
      <Card>
        <h2 style={{color: "#5f43b2", fontWeight: "800", fontSize: "1.5rem", marginBottom: "1.2rem"}}>My Profile</h2>
        <div style={{marginBottom:12}}><b>Name:</b> {user.name}</div>
        <div style={{marginBottom:12}}><b>Email:</b> {user.email}</div>
      </Card>
    </Wrapper>
  );
}

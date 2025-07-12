import styled from "styled-components";
import { Link, useLocation } from "react-router-dom";

const Nav = styled.nav`
  background: #fff;
  box-shadow: 0 2px 14px rgba(95,67,178,0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.9rem 2rem;
  position: sticky;
  top: 0;
  z-index: 10;
`;
const Logo = styled(Link)`
  color: #7b42f6;
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: -1px;
`;
const NavLinks = styled.div`
  display: flex;
  gap: 1.7rem;
  align-items: center;
`;
const NavLink = styled(Link)`
  color: #5f43b2;
  font-weight: 600;
  font-size: 1.07rem;
  opacity: ${({ active }) => (active ? "1" : ".67")};
  border-bottom: ${({ active }) => (active ? "2px solid #7b42f6" : "none")};
  padding-bottom: 2px;
`;

export default function Navbar() {
  const location = useLocation();
  return (
    <Nav>
      <Logo to="/">JobPortal</Logo>
      <NavLinks>
        <NavLink to="/" active={location.pathname === "/"}>Home</NavLink>
        <NavLink to="/profile" active={location.pathname === "/profile"}>Profile</NavLink>
        <NavLink to="/login" active={location.pathname === "/login"}>Login</NavLink>
        <NavLink to="/signup" active={location.pathname === "/signup"}>Signup</NavLink>
      </NavLinks>
    </Nav>
  );
}

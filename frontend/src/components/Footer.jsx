import styled from "styled-components";

const Foot = styled.footer`
  background: #5f43b2;
  color: #fff;
  text-align: center;
  padding: 1.4rem 0 1.2rem 0;
  font-size: 1rem;
  letter-spacing: 0.05em;
  margin-top: 4rem;
`;

export default function Footer() {
  return (
    <Foot>
      © {new Date().getFullYear()} JobPortal &mdash; All rights reserved.
    </Foot>
  );
}

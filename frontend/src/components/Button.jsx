import styled from "styled-components";

const Button = styled.button`
  background: linear-gradient(90deg, #7b42f6 0%, #5f43b2 100%);
  color: #fff;
  padding: 14px 32px;
  border-radius: 8px;
  border: none;
  font-size: 1rem;
  font-weight: 700;
  box-shadow: 0 4px 20px rgba(95,67,178,0.08);
  margin-top: 10px;
  transition: background 0.2s, transform 0.1s;
  cursor: pointer;
  &:hover {
    background: linear-gradient(90deg, #a084ee 0%, #7b42f6 100%);
    transform: translateY(-2px) scale(1.03);
  }
  &:active {
    background: #5f43b2;
    transform: scale(0.98);
  }
`;

export default Button;

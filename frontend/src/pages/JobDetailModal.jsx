import styled from "styled-components";
import Button from "../components/Button";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(30,18,67,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;
const Modal = styled.div`
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 12px 36px rgba(95,67,178,0.13);
  padding: 2.3rem 2.5rem;
  max-width: 95vw;
  width: 420px;
`;

export default function JobDetailModal({ job, onClose }) {
  return (
    <Overlay onClick={onClose}>
      <Modal onClick={e => e.stopPropagation()}>
        <h2 style={{color:"#7b42f6", fontWeight:800, marginBottom:14}}>{job.position}</h2>
        <div style={{marginBottom:8}}><b>Company:</b> {job.company}</div>
        <div style={{marginBottom:8}}><b>Location:</b> {job.location || "Remote"}</div>
        <div style={{marginBottom:20}}><b>Tags:</b> {job.tags?.join(", ")}</div>
        <div style={{marginBottom:16, color:"#444"}}>{job.description?.slice(0, 320) || "No description"}</div>
        <a href={job.url} target="_blank" rel="noopener noreferrer">
          <Button>Apply on RemoteOK</Button>
        </a>
        <Button style={{background:"#ccc", color:"#5f43b2", marginLeft:12}} onClick={onClose}>Close</Button>
      </Modal>
    </Overlay>
  );
}

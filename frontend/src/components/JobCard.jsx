import styled from "styled-components";
import Button from "./Button";
import { useState } from "react";
import JobDetailModal from "../pages/JobDetailModal";

const Card = styled.div`
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 6px 36px rgba(95,67,178,0.09);
  padding: 2.1rem 2.3rem;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Position = styled.h3`
  color: #7b42f6;
  font-size: 1.35rem;
  margin-bottom: 3px;
  font-weight: 700;
`;
const Company = styled.div`
  color: #333;
  font-size: 1.07rem;
  font-weight: 500;
`;
const Tag = styled.div`
  color: #8d75bf;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 0.5rem;
`;

export default function JobCard({ job }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <Card>
        <Position>{job.position}</Position>
        <Company>{job.company} {job.location ? `· ${job.location}` : ""}</Company>
        <Tag>{job.tags?.slice(0,3).join(", ")}</Tag>
        <Button onClick={() => setShow(true)}>View Details</Button>
      </Card>
      {show && <JobDetailModal job={job} onClose={() => setShow(false)} />}
    </>
  );
}

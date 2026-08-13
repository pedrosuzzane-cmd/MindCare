import React from "react";

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

export default function PurityTest({ date }: { date?: Date }) {
  const lastAssessed = date ? daysSince(date) : null;
  return <Text>{lastAssessed}</Text>;
}

const Text = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

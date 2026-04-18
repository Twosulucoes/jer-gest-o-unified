import { ReactNode } from "react";
import ReportHeader from "./ReportHeader";
import ReportFooter from "./ReportFooter";

interface ReportShellProps {
  eventId?: string | null;
  children: ReactNode;
  pageNumber?: number;
  totalPages?: number;
  generatedAt?: Date;
  className?: string;
}

export function ReportShell({
  eventId,
  children,
  pageNumber,
  totalPages,
  generatedAt,
  className = "",
}: ReportShellProps) {
  return (
    <div className={`bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6 md:p-8 ${className}`}>
      <ReportHeader eventId={eventId} />
      <main className="my-4">{children}</main>
      <ReportFooter
        eventId={eventId}
        pageNumber={pageNumber}
        totalPages={totalPages}
        generatedAt={generatedAt}
      />
    </div>
  );
}

export default ReportShell;

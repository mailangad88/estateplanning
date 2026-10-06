import { firm } from "@/config/firm";

/**
 * Self-booking after a consult request (L8). Renders the firm's scheduler in an iframe only when
 * `firm.schedulerUrl` is set; otherwise shows the "our team will reach out" message and loads
 * nothing from a third party.
 */
export default function ConsultScheduler({ url = firm.schedulerUrl }: { url?: string | null }) {
  const safe = url && /^https:\/\//i.test(url) ? url : null;
  if (!safe) {
    return (
      <p className="lead">
        Someone from our intake team will contact you during office hours ({firm.officeHours}) to set up your consult.
        If anything is urgent, call {firm.phone}.
      </p>
    );
  }
  return (
    <>
      <h2>Pick a time for your consult</h2>
      <p>
        Choose a time that works for you below. If none fit, our intake team will contact you during office hours
        ({firm.officeHours}).
      </p>
      <iframe
        className="scheduler"
        src={safe}
        title="Consult scheduling calendar"
        loading="lazy"
        style={{ width: "100%", minHeight: 680, border: 0 }}
      />
      <p className="notice">
        Calendar not loading? <a href={safe} target="_blank" rel="noopener noreferrer">Open the scheduling page in a new tab</a>.
      </p>
    </>
  );
}

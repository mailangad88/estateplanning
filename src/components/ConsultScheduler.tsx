import { firm } from "@/config/firm";
import CalcomEmbed from "@/components/CalcomEmbed";

/**
 * Self-booking after a consult request (L8). With `firm.calcomLink` set it renders the Cal.com inline
 * embed (and loads Cal.com's embed.js only then). Otherwise it renders `firm.schedulerUrl` in an iframe when set; otherwise shows the "our team will reach out" message and loads
 * nothing from a third party.
 */
export default function ConsultScheduler({
  url = firm.schedulerUrl,
  calcomLink = firm.calcomLink,
  name,
  email,
  leadRef,
}: {
  url?: string | null;
  calcomLink?: string | null;
  name?: string;
  email?: string;
  leadRef?: string;
}) {
  if (calcomLink) {
    const page = `https://cal.com/${calcomLink}`;
    return (
      <>
        <h2>Pick a time for your consult</h2>
        <p>
          Choose a time that works for you below. If none fit, our intake team will contact you during office hours
          ({firm.officeHours}).
        </p>
        <CalcomEmbed link={calcomLink} name={name} email={email} leadRef={leadRef} />
        <p className="notice">
          Calendar not loading? <a href={page} target="_blank" rel="noopener noreferrer">Open the scheduling page in a new tab</a>.
        </p>
      </>
    );
  }
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

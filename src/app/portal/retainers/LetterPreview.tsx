import { fieldLabel, type Segment } from "@/lib/retainerTemplates";
import styles from "./retainers.module.css";

/** A filled letter with each merge field marked: filled in green, missing in clay with a dashed outline. */
export function LetterPreview({ segments, onMissingClick }: { segments: Segment[]; onMissingClick?: (field: string) => void }) {
  return (
    <div className={styles.preview} aria-label="Letter preview">
      {segments.map((s, i) =>
        "field" in s ? (
          s.value ? (
            <mark key={i} className={styles.filled} title={fieldLabel(s.field)}>{s.value}</mark>
          ) : (
            <mark
              key={i}
              className={styles.missing}
              title="Missing: fill it in below"
              onClick={onMissingClick ? () => onMissingClick(s.field) : undefined}
            >
              {fieldLabel(s.field)}: missing
            </mark>
          )
        ) : /\{\{/.test(s.text) ? (
          <mark key={i} className={styles.unknown} title="Not a merge field">{s.text}</mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </div>
  );
}

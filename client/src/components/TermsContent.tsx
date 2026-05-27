import { strings } from "../lib/strings";

export function TermsContent() {
  return (
    <div className="space-y-3">
      <p className="font-semibold text-slate-200">{strings.terms.title}</p>

      <p><span className="text-slate-200">{strings.terms.aboutHeading}</span><br />
      {strings.terms.aboutBody}</p>

      <p><span className="text-slate-200">{strings.terms.dataHeading}</span><br />
      {strings.terms.dataBody}</p>

      <p><span className="text-slate-200">{strings.terms.serverHeading}</span><br />
      {strings.terms.serverBody}</p>

      <p><span className="text-slate-200">{strings.terms.authHeading}</span><br />
      {strings.terms.authBody}</p>

      <p><span className="text-slate-200">{strings.terms.disclaimerHeading}</span><br />
      {strings.terms.disclaimerBody}</p>

      <p><span className="text-slate-200">{strings.terms.changesHeading}</span><br />
      {strings.terms.changesBody}</p>
    </div>
  );
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBill = normalizeBill;
/**
 * Coarse "where in the process" stage derived from the action history. Heuristic
 * (text-based), returns the furthest milestone reached.
 */
function deriveStage(actions = []) {
    if (!actions.length)
        return null;
    const texts = actions.map((a) => String(a.text ?? '').toLowerCase());
    const has = (re) => texts.some((t) => re.test(t));
    if (has(/became (public|private) law|signed by president/))
        return 'Became Law';
    if (has(/vetoed/))
        return 'Vetoed';
    if (has(/presented to president|to president/))
        return 'To President';
    const passedHouse = has(/passed house|agreed to in house|passed\/agreed to in house/);
    const passedSenate = has(/passed senate|agreed to in senate|passed\/agreed to in senate/);
    if (passedHouse && passedSenate)
        return 'Passed Both Chambers';
    if (passedSenate)
        return 'Passed Senate';
    if (passedHouse)
        return 'Passed House';
    if (has(/failed|rejected/))
        return 'Failed';
    if (has(/reported by|ordered to be reported|committee/))
        return 'In Committee';
    if (has(/introduced/))
        return 'Introduced';
    return 'In Committee';
}
/** Most recent summary by action date (summaries arrive oldest-first). */
function pickLatestSummary(summaries = []) {
    return [...summaries].sort((a, b) => String(b.actionDate).localeCompare(String(a.actionDate)))[0];
}
/** Formatted-text (HTML) URL of the most recent text version, for the simplifier. */
function pickTextVersionUrl(textVersions = []) {
    const latest = [...textVersions].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (!latest?.formats?.length)
        return null;
    const formatted = latest.formats.find((f) => f.type === 'Formatted Text');
    return (formatted ?? latest.formats[0]).url ?? null;
}
function normalizeBill({ bill, summaries, subjects, textVersions, actions }) {
    const sponsor = bill.sponsors?.[0];
    const latestSummary = pickLatestSummary(summaries);
    const subjectNames = (subjects?.legislativeSubjects ?? []).map((s) => s.name).filter(Boolean);
    const latestActionDate = bill.latestAction?.actionDate ? new Date(bill.latestAction.actionDate) : null;
    return {
        congress: Number(bill.congress),
        billType: String(bill.type).toLowerCase(),
        billNumber: String(bill.number),
        title: bill.title,
        summary: latestSummary?.text ?? null,
        status: bill.latestAction?.text ?? null, // coarse label
        stage: deriveStage(actions),
        actions: actions && actions.length ? actions : null,
        chamber: bill.originChamber ?? null,
        originChamber: bill.originChamber ?? null,
        policyArea: bill.policyArea?.name ?? subjects?.policyArea?.name ?? null,
        subjects: subjectNames.length ? subjectNames : null,
        cosponsorCount: bill.cosponsors?.count ?? null,
        congressGovUrl: bill.legislationUrl ?? null,
        textVersionUrl: pickTextVersionUrl(textVersions),
        latestActionText: bill.latestAction?.text ?? null,
        latestActionDate,
        introducedDate: bill.introducedDate ? new Date(bill.introducedDate) : null,
        lastActionDate: latestActionDate,
        sponsorBioguideId: sponsor?.bioguideId ?? null,
    };
}

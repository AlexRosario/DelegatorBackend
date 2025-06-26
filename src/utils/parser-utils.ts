export const parseSenateVoteXML = (xmlText: string) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

  // Extract metadata
  const get = (tag: string) =>
    xmlDoc.querySelector(tag)?.textContent?.trim() || '';

  const metadata = {
    congress: get('congress'),
    session: get('session'),
    voteNumber: get('vote_number'),
    voteDate: get('vote_date'),
    question: get('vote_question_text'),
    title: get('vote_title'),
    result: get('vote_result'),
    resultText: get('vote_result_text'),
    documentName: get('document_name'),
    documentTitle: get('document_title'),
    yeas: get('yeas'),
    nays: get('nays'),
    absent: get('absent')
  };

  // Extract votes
  const votes = Array.from(xmlDoc.querySelectorAll('member')).map((node) => ({
    fullName: node.querySelector('member_full')?.textContent || '',
    firstName: node.querySelector('first_name')?.textContent || '',
    lastName: node.querySelector('last_name')?.textContent || '',
    party: node.querySelector('party')?.textContent || '',
    state: node.querySelector('state')?.textContent || '',
    voteCast: node.querySelector('vote_cast')?.textContent || '',
    lisMemberId: node.querySelector('lis_member_id')?.textContent || ''
  }));

  return { metadata, votes };
};

export interface RecordedVote {
  chamber: string;
  congress: number;
  date: string;
  rollNumber: number;
  sessionNumber: number;
  url: string;
}
export interface Actions {
  actionCode: string;
  actionDate: string;
  sourceSystem: { code: number; name: string };
  text: string;
  type: string;
  recordedVotes: RecordedVote[];
}

interface Committees {
  count: number;
  url: string;
}

interface Cosponsors {
  count: number;
  countIncludingWithdrawnCosponsors: number;
  url: string;
}

interface LatestAction {
  actionDate: string;
  text: string;
}

interface Sponsor {
  bioguideId: string;
  firstName: string;
  fullName: string;
  isByRequest: string;
  lastName: string;
  middleName: string;
  party: string;
  state: string;
  url: string;
}

interface Titles {
  count: number;
  url: string;
}

export interface Bill {
  subjects: any;
  actions: Actions[];
  committees: Committees;
  congress: number;
  cosponsors: Cosponsors;
  introducedDate: string;
  latestAction: LatestAction;
  number: string;
  originChamber: string;
  originChamberCode: string;
  sponsors: Sponsor[];
  summary: string;
  title: string;
  titles: Titles;
  type: string;
  updateDate: string;
  updateDateIncludingText: string;
  url: string;
  policyArea: {
    name: string;
  };
}
export type FrontEndRegistrant = {
  username: string;
  email: string;
  password: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipcode: string;
  };
};
export type User = {
  id: number;
  username: string;
  email: string;
  zipcode: string;
};

export interface Vote {
  userId: number;
  billId: string;
  vote: 'Yes' | 'No';
  date: Date;
}

export type AddressInformation = {
  city: string;
  district: string;
  officeAddress: string;
  phoneNumber: string;
  zipCode: number;
};

export type Depiction = {
  attribution: string;
  imageUrl: string;
};

export type LegislationInfo = {
  count: number;
  url: string;
};

export type PartyHistory = {
  party: string;
  startDate?: string;
  endDate?: string;
};

export type Term = {
  congress: string;
  startDate: string;
  endDate: string;
  state: string;
  district?: string;
};

export type FieldOffice = {
  phone: string;
  city: string;
};

export type CongressMember = {
  addressInformation: AddressInformation;
  area: 'US House' | 'US Senate';
  bioguideId: string;
  birthYear: string;
  cosponsoredLegislation: LegislationInfo;
  currentMember: boolean;
  depiction: Depiction;
  directOrderName: string;
  district: string;
  field_offices: FieldOffice[];
  firstName: string;
  honorificName: string;
  id: string;
  invertedOrderName: string;
  lastName: string;
  name: string;
  officialWebsiteUrl: string;
  party: string;
  partyHistory: PartyHistory[];
  phone: string;
  photoURL: string;
  reason: string;
  sponsoredLegislation: LegislationInfo;
  state: string;
  terms: Term[];
  updateDate: string; // ISO date string
  url: string;
};

export type Representative5Calls = {
  id: string;
  name: string;
  phone: string;
  url: string;
  photoURL: string;
  party: string;
  state: string;
  district?: string; // optional, since senators don't have it
  reason: string;
  area: 'US House' | 'US Senate';
  field_offices: FieldOffice[];
};

export type MemberVote = {
  bioguideId: string;
  billId: string;
  vote: 'Yea' | 'Nay' | 'Present' | 'Not Voting';
  date: string; // ISO date string
};
type PartyVotes = {
  yes: number;
  no: number;
  present: number;
  not_voting: number;
};

export type RollCall = {
  copyright: string;
  results: {
    votes: {
      vacant_seats: Array<Record<string, unknown>>;
      vote: {
        amendment: Record<string, unknown>;
        bill: string;
        chamber: string;
        congress: number;
        date: string;
        democratic: PartyVotes;
        description: string;
        independent: PartyVotes;
        positions: Array<Record<string, unknown>>;
        question: string;
        question_text: string;
        republican: PartyVotes;
        result: string;
        roll_call: number;
        session: number;
        source: string;
        time: string;
        total: PartyVotes;
        url: string;
        vote_type: string;
      };
    };
  };
  status: string;
};

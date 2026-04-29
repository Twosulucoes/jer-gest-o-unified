export interface Guest {
  occupancy_id: string;
  participant_id: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  unit_name: string;
  unit_id: string;
  location_name: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  photo_url: string | null;
  gender: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  coach_name: string | null;
  coach_phone: string | null;
  delegation_name: string | null;
  delegation_id: string | null;
}

export interface PersonDetail {
  id: string;
  full_name: string;
  birth_date: string | null;
  gender: string;
  participant_type: string;
  delegation_name: string | null;
  is_checked_in: boolean;
  stay_checkin_at: string | null;
  facility_name: string | null;
  bed_code: string | null;
  room_code: string | null;
  block_name: string | null;
}

export interface MissingPerson {
  id: string;
  full_name: string;
  delegation_name: string;
}

export interface DuplicateStay {
  person_id: string;
  person_name: string;
  rooms: string[];
}

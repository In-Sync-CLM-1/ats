// Indian States and Cities data for dropdown selections

export interface StateData {
  name: string;
  code: string;
  cities: { name: string; code: string }[];
}

export const INDIAN_STATES: StateData[] = [
  {
    name: "Andhra Pradesh",
    code: "AP",
    cities: [
      { name: "Visakhapatnam", code: "VIZ" },
      { name: "Vijayawada", code: "VJA" },
      { name: "Guntur", code: "GNT" },
      { name: "Nellore", code: "NLR" },
      { name: "Tirupati", code: "TPT" },
      { name: "Rajahmundry", code: "RJY" },
      { name: "Kakinada", code: "KKD" },
    ],
  },
  {
    name: "Arunachal Pradesh",
    code: "AR",
    cities: [
      { name: "Itanagar", code: "ITN" },
      { name: "Naharlagun", code: "NHG" },
    ],
  },
  {
    name: "Assam",
    code: "AS",
    cities: [
      { name: "Guwahati", code: "GHY" },
      { name: "Silchar", code: "SLC" },
      { name: "Dibrugarh", code: "DIB" },
      { name: "Jorhat", code: "JOR" },
    ],
  },
  {
    name: "Bihar",
    code: "BR",
    cities: [
      { name: "Patna", code: "PAT" },
      { name: "Gaya", code: "GAY" },
      { name: "Bhagalpur", code: "BGP" },
      { name: "Muzaffarpur", code: "MZP" },
      { name: "Darbhanga", code: "DBG" },
    ],
  },
  {
    name: "Chhattisgarh",
    code: "CG",
    cities: [
      { name: "Raipur", code: "RPR" },
      { name: "Bhilai", code: "BHL" },
      { name: "Bilaspur", code: "BSP" },
      { name: "Durg", code: "DRG" },
    ],
  },
  {
    name: "Delhi",
    code: "DL",
    cities: [
      { name: "New Delhi", code: "NDL" },
      { name: "Delhi", code: "DEL" },
      { name: "Noida", code: "NOI" },
      { name: "Gurgaon", code: "GGN" },
      { name: "Faridabad", code: "FBD" },
      { name: "Ghaziabad", code: "GZB" },
    ],
  },
  {
    name: "Goa",
    code: "GA",
    cities: [
      { name: "Panaji", code: "PNJ" },
      { name: "Margao", code: "MAO" },
      { name: "Vasco da Gama", code: "VSC" },
    ],
  },
  {
    name: "Gujarat",
    code: "GJ",
    cities: [
      { name: "Ahmedabad", code: "AMD" },
      { name: "Surat", code: "SUR" },
      { name: "Vadodara", code: "VAD" },
      { name: "Rajkot", code: "RJK" },
      { name: "Gandhinagar", code: "GDN" },
      { name: "Bhavnagar", code: "BHV" },
    ],
  },
  {
    name: "Haryana",
    code: "HR",
    cities: [
      { name: "Gurugram", code: "GGM" },
      { name: "Faridabad", code: "FDB" },
      { name: "Chandigarh", code: "CHD" },
      { name: "Panipat", code: "PNP" },
      { name: "Ambala", code: "AMB" },
      { name: "Karnal", code: "KNL" },
    ],
  },
  {
    name: "Himachal Pradesh",
    code: "HP",
    cities: [
      { name: "Shimla", code: "SML" },
      { name: "Dharamshala", code: "DHS" },
      { name: "Manali", code: "MNL" },
      { name: "Kullu", code: "KLU" },
    ],
  },
  {
    name: "Jharkhand",
    code: "JH",
    cities: [
      { name: "Ranchi", code: "RNC" },
      { name: "Jamshedpur", code: "JMP" },
      { name: "Dhanbad", code: "DHN" },
      { name: "Bokaro", code: "BKR" },
    ],
  },
  {
    name: "Karnataka",
    code: "KA",
    cities: [
      { name: "Bengaluru", code: "BLR" },
      { name: "Mysuru", code: "MYS" },
      { name: "Mangaluru", code: "MNG" },
      { name: "Hubli", code: "HBL" },
      { name: "Belgaum", code: "BGM" },
      { name: "Shimoga", code: "SMG" },
    ],
  },
  {
    name: "Kerala",
    code: "KL",
    cities: [
      { name: "Thiruvananthapuram", code: "TVM" },
      { name: "Kochi", code: "KCH" },
      { name: "Kozhikode", code: "KZK" },
      { name: "Thrissur", code: "TSR" },
      { name: "Kannur", code: "KNR" },
    ],
  },
  {
    name: "Madhya Pradesh",
    code: "MP",
    cities: [
      { name: "Bhopal", code: "BPL" },
      { name: "Indore", code: "IND" },
      { name: "Jabalpur", code: "JBP" },
      { name: "Gwalior", code: "GWL" },
      { name: "Ujjain", code: "UJN" },
    ],
  },
  {
    name: "Maharashtra",
    code: "MH",
    cities: [
      { name: "Mumbai", code: "MUM" },
      { name: "Pune", code: "PUN" },
      { name: "Nagpur", code: "NGP" },
      { name: "Nashik", code: "NSK" },
      { name: "Thane", code: "THN" },
      { name: "Aurangabad", code: "AUR" },
      { name: "Navi Mumbai", code: "NVM" },
    ],
  },
  {
    name: "Manipur",
    code: "MN",
    cities: [
      { name: "Imphal", code: "IMP" },
    ],
  },
  {
    name: "Meghalaya",
    code: "ML",
    cities: [
      { name: "Shillong", code: "SHL" },
    ],
  },
  {
    name: "Mizoram",
    code: "MZ",
    cities: [
      { name: "Aizawl", code: "AZL" },
    ],
  },
  {
    name: "Nagaland",
    code: "NL",
    cities: [
      { name: "Kohima", code: "KHM" },
      { name: "Dimapur", code: "DMP" },
    ],
  },
  {
    name: "Odisha",
    code: "OD",
    cities: [
      { name: "Bhubaneswar", code: "BBS" },
      { name: "Cuttack", code: "CTK" },
      { name: "Rourkela", code: "RKL" },
      { name: "Puri", code: "PRI" },
    ],
  },
  {
    name: "Punjab",
    code: "PB",
    cities: [
      { name: "Chandigarh", code: "CHG" },
      { name: "Ludhiana", code: "LDH" },
      { name: "Amritsar", code: "ASR" },
      { name: "Jalandhar", code: "JLR" },
      { name: "Patiala", code: "PTL" },
    ],
  },
  {
    name: "Rajasthan",
    code: "RJ",
    cities: [
      { name: "Jaipur", code: "JAI" },
      { name: "Jodhpur", code: "JDH" },
      { name: "Udaipur", code: "UDR" },
      { name: "Kota", code: "KOT" },
      { name: "Ajmer", code: "AJM" },
      { name: "Bikaner", code: "BKN" },
    ],
  },
  {
    name: "Sikkim",
    code: "SK",
    cities: [
      { name: "Gangtok", code: "GTK" },
    ],
  },
  {
    name: "Tamil Nadu",
    code: "TN",
    cities: [
      { name: "Chennai", code: "CHN" },
      { name: "Coimbatore", code: "CBE" },
      { name: "Madurai", code: "MDU" },
      { name: "Tiruchirappalli", code: "TRY" },
      { name: "Salem", code: "SLM" },
      { name: "Tiruppur", code: "TPR" },
    ],
  },
  {
    name: "Telangana",
    code: "TS",
    cities: [
      { name: "Hyderabad", code: "HYD" },
      { name: "Warangal", code: "WGL" },
      { name: "Nizamabad", code: "NZB" },
      { name: "Karimnagar", code: "KRM" },
      { name: "Secunderabad", code: "SEC" },
    ],
  },
  {
    name: "Tripura",
    code: "TR",
    cities: [
      { name: "Agartala", code: "AGL" },
    ],
  },
  {
    name: "Uttar Pradesh",
    code: "UP",
    cities: [
      { name: "Lucknow", code: "LKO" },
      { name: "Kanpur", code: "KNP" },
      { name: "Varanasi", code: "VNS" },
      { name: "Agra", code: "AGR" },
      { name: "Noida", code: "NOD" },
      { name: "Ghaziabad", code: "GZD" },
      { name: "Prayagraj", code: "PRY" },
      { name: "Meerut", code: "MRT" },
    ],
  },
  {
    name: "Uttarakhand",
    code: "UK",
    cities: [
      { name: "Dehradun", code: "DDN" },
      { name: "Haridwar", code: "HRW" },
      { name: "Rishikesh", code: "RSH" },
      { name: "Nainital", code: "NNT" },
    ],
  },
  {
    name: "West Bengal",
    code: "WB",
    cities: [
      { name: "Kolkata", code: "KOL" },
      { name: "Howrah", code: "HWH" },
      { name: "Durgapur", code: "DGP" },
      { name: "Siliguri", code: "SLG" },
      { name: "Asansol", code: "ASN" },
    ],
  },
];

export function getStateByCode(code: string): StateData | undefined {
  return INDIAN_STATES.find((state) => state.code === code);
}

export function getCitiesByStateCode(stateCode: string): { name: string; code: string }[] {
  const state = getStateByCode(stateCode);
  return state?.cities || [];
}

export function generateClientCode(companyName: string): string {
  // Take first 3 letters of the first word, uppercase
  const words = companyName.trim().split(/\s+/);
  if (words.length === 0) return "XXX";
  
  const firstWord = words[0].replace(/[^a-zA-Z]/g, "");
  return firstWord.substring(0, 3).toUpperCase().padEnd(3, "X");
}

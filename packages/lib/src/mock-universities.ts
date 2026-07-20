/**
 * Manhaji demo fixture — university reference list.
 * Mirrors the 40 rows seeded into the `universities` table by migration 020.
 * Used by the student Add-university pop-up when there is no signed-in session
 * (the DB list is authenticated-only) — the "OR" demo fallback.
 */

export type MockUniversity = {
  id: string;      // demo-only id, prefixed so it is never mistaken for a uuid
  name: string;
  country: string;
  region: string;  // 'GCC' | 'Middle East' | 'UK' | 'US' | 'Canada' | 'Australia'
};

const U = (name: string, country: string, region: string, i: number): MockUniversity => ({
  id: `demo-uni-${i}`, name, country, region,
});

export const MOCK_UNIVERSITIES: MockUniversity[] = [
  // GCC / Middle East
  U("Sultan Qaboos University",                         "Oman",           "GCC", 1),
  U("German University of Technology in Oman",          "Oman",           "GCC", 2),
  U("University of Nizwa",                              "Oman",           "GCC", 3),
  U("United Arab Emirates University",                  "UAE",            "GCC", 4),
  U("American University of Sharjah",                   "UAE",            "GCC", 5),
  U("Khalifa University",                               "UAE",            "GCC", 6),
  U("New York University Abu Dhabi",                    "UAE",            "GCC", 7),
  U("Qatar University",                                 "Qatar",          "GCC", 8),
  U("King Fahd University of Petroleum and Minerals",   "Saudi Arabia",   "GCC", 9),
  U("American University of Beirut",                    "Lebanon",        "Middle East", 10),
  // UK
  U("University of Oxford",                             "United Kingdom", "UK", 11),
  U("University of Cambridge",                          "United Kingdom", "UK", 12),
  U("Imperial College London",                          "United Kingdom", "UK", 13),
  U("University College London",                        "United Kingdom", "UK", 14),
  U("London School of Economics and Political Science", "United Kingdom", "UK", 15),
  U("University of Edinburgh",                          "United Kingdom", "UK", 16),
  U("University of Manchester",                         "United Kingdom", "UK", 17),
  U("King's College London",                            "United Kingdom", "UK", 18),
  U("University of Warwick",                            "United Kingdom", "UK", 19),
  U("University of Bristol",                            "United Kingdom", "UK", 20),
  // US
  U("Massachusetts Institute of Technology",            "United States",  "US", 21),
  U("Stanford University",                              "United States",  "US", 22),
  U("Harvard University",                               "United States",  "US", 23),
  U("University of California, Berkeley",               "United States",  "US", 24),
  U("University of Michigan",                           "United States",  "US", 25),
  U("New York University",                              "United States",  "US", 26),
  U("Boston University",                                "United States",  "US", 27),
  U("Georgia Institute of Technology",                  "United States",  "US", 28),
  U("Purdue University",                                "United States",  "US", 29),
  U("University of Illinois Urbana-Champaign",          "United States",  "US", 30),
  // Canada
  U("University of Toronto",                            "Canada",         "Canada", 31),
  U("University of British Columbia",                   "Canada",         "Canada", 32),
  U("McGill University",                                "Canada",         "Canada", 33),
  U("University of Waterloo",                           "Canada",         "Canada", 34),
  U("McMaster University",                              "Canada",         "Canada", 35),
  // Australia
  U("University of Melbourne",                          "Australia",      "Australia", 36),
  U("University of Sydney",                             "Australia",      "Australia", 37),
  U("University of New South Wales",                    "Australia",      "Australia", 38),
  U("Australian National University",                   "Australia",      "Australia", 39),
  U("Monash University",                                "Australia",      "Australia", 40),
];

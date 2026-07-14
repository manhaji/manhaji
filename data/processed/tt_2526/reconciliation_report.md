# ISO 2025-26 timetable reconciliation report

- Classes-page lessons extracted: 1920
- Teacher-page lessons extracted: 1629
- Matched checks, classes->teachers: 1918
- Matched checks, teachers->classes: 1998
- Matched (directional total, both directions summed -- each real assignment counts once per direction): 3916
- Total diffs: 4
- Documented exceptions: 4
- Stale exceptions (explain no current diff): 0
- Unexplained diffs: 0

## Documented exceptions

- `classes|Grade 12C-A2|Sun|P7|Biology|Hilda Mucharafieh`: Classes-page over-span: the Grade 12C-A2 Sunday stacked Physics/Biology cell is merged across P7-P8 on the classes page, which over-spans Biology. Hilda Mucharafieh's teacher page shows the true placement -- Biology for Grade 12C-A2 at P8 only (her P7 that day is Bio SS for Grade 10A/Grade 10B, and no vline is missing between her P7/P8 columns). The teacher view is the precise one; prefer it downstream.
- `classes|Grade 12C-A2|Tue|P5|Economics|Mohd Wassim`: Classes-page over-span: the Grade 12C-A2 Tuesday stacked Chemistry/Economics cell is merged across P4-P5 on the classes page, which over-spans Economics. Mohd Wassim's teacher page shows the true placement -- Economics for Grade 12C-A2 at P4 only (his P5 that day is genuinely blank/free; verified no words in that column and no missing vline). The teacher view is the precise one; prefer it downstream.
- `classes|Grade 12C-A2|Wed|P1|Economics|Mohd Wassim`: Classes-page over-span: the Grade 12C-A2 Wednesday stacked Chemistry/Economics cell is merged across P1-P2 on the classes page, which over-spans Economics. Mohd Wassim's teacher page shows the true placement -- Economics for Grade 12C-A2 at P2 only (his P1 that day is Business Studies for Grade 10A/Grade 10B). The teacher view is the precise one; prefer it downstream.
- `classes|Grade 12C-A2|Thu|P7|Physics|Hussein Kameh`: Classes-page over-span: the Grade 12C-A2 Thursday stacked Physics/Biology cell is merged across P7-P8 on the classes page, which over-spans Physics for this section. Hussein Kameh's teacher page shows the true placement -- Physics for Grade 12C-A2 at P8 only (his P7 that day is Physics for Grade 11A-GED). The teacher view is the precise one; prefer it downstream.

## Known over-spans (classes page vs teacher pages)

The classes-page lesson records below are faithful transcriptions of merged stacked cells that OVER-span one of their stacked entries; the teacher pages show the true single-period placement. Prefer the teacher view for these tuples downstream.

- `classes|Grade 12C-A2|Sun|P7|Biology|Hilda Mucharafieh` -- classes page merges the stacked cell across both periods; teacher pages show the true single-period placement -- prefer teacher view downstream.
- `classes|Grade 12C-A2|Tue|P5|Economics|Mohd Wassim` -- classes page merges the stacked cell across both periods; teacher pages show the true single-period placement -- prefer teacher view downstream.
- `classes|Grade 12C-A2|Wed|P1|Economics|Mohd Wassim` -- classes page merges the stacked cell across both periods; teacher pages show the true single-period placement -- prefer teacher view downstream.
- `classes|Grade 12C-A2|Thu|P7|Physics|Hussein Kameh` -- classes page merges the stacked cell across both periods; teacher pages show the true single-period placement -- prefer teacher view downstream.

## Per-band bell table (as parsed)

### KG
- Periods: P1, P2, P3, P4, P5, P6
- B1: 9:30-9:50 (after P2)
- B2: 11:15-11:55 (after P4)

### Gr1-6
- Periods: P1, P2, P3, P4, P5, P6, P7, P8
- B1: 9:30-9:50 (after P2)
- B2: 11:55-12:35 (after P5)

### Gr7-12
- Periods: P1, P2, P3, P4, P5, P6, P7, P8
- B1: 10:15-10:35 (after shifted P3 9:30-10:15)
- B2: 12:35-13:20 (after P6)

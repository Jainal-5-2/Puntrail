# Development Plan
## GIS-Based Cemetery Mapping and Burial Information Management System for Isabela City, Basilan

## 1. Project Overview

The project aims to develop a GIS-based mobile application that allows authorized personnel to manage cemetery burial information and enables visitors to search for deceased individuals and locate their corresponding burial plots on a digital map.

The system will represent individual burial plots as geographic polygons. A visitor can search using a person's full or partial name, select the correct record from the results, and view the associated burial plot highlighted on the map.

The system will also support offline functionality. Users will be able to access previously downloaded cemetery maps, search cached burial records, and view burial plot locations without an active internet connection.

The initial implementation will focus on one selected cemetery in Isabela City, Basilan. The system should be designed so that additional cemeteries can be supported in a future version, subject to data availability and authorization.

## 2. Project Objectives

1. Develop a digital map of the selected cemetery containing individual burial plot boundaries.
2. Develop a burial information management module for authorized administrators.
3. Provide name-based search for deceased individuals.
4. Display the selected person's approved burial information and highlight the corresponding plot on the map.
5. Provide tools for authorized personnel to create, update, and maintain burial plot geometries and records.
6. Implement offline access to previously downloaded cemetery maps and burial information.
7. Implement synchronization between locally stored data and the central database when internet connectivity becomes available.
8. Evaluate the system's functionality, usability, performance, and geographic data quality.

## 3. Project Scope

### 3.1 Included Features

**Visitor Features**
- View the digital cemetery map.
- Search burial records by full or partial name.
- View matching search results.
- Select a record and view approved burial details.
- Navigate to and highlight the associated burial plot on the map.
- View plot or section identifiers where available and approved for display.
- Access previously downloaded cemetery maps and burial records while offline.

**Administrator Features**
- Secure administrator authentication.
- Create, view, update, and manage burial records.
- Create and edit individual burial plot polygons.
- Associate burial records with their corresponding plots.
- Manage plot identifiers and occupancy information when reliable records are available.
- Review and correct mapped plot information.
- Queue permitted changes made offline and synchronize them when connectivity returns.
- Manage cemetery and section information if section boundaries are included in the approved mapping data.

**Offline Features**
- Cache approved burial records and plot geometries in a local database.
- Download and retain an authorized offline map area before going offline.
- Search cached burial records without an internet connection.
- Display cached plot polygons and highlight the selected plot offline.
- Queue supported administrative edits locally and synchronize them when the device reconnects.
- Display synchronization status, including pending, synchronized, and failed changes.
- Display the last synchronization time to indicate whether locally available information may be outdated.

### 3.2 Excluded or Deferred Features

The initial version will not include:
- AI-based identification or prediction.
- Automated grave detection from imagery.
- Payment processing.
- Public editing of burial records or map geometries.
- Precise indoor positioning or turn-by-turn navigation.
- Multi-cemetery deployment unless the initial data access and project schedule make it feasible.

Offline capability will be implemented incrementally. Offline viewing and searching will be prioritized before offline editing. Offline editing requires conflict handling, auditability, and clear rules about which records may be changed without a live connection.

## 4. Users and Permissions

### Visitor
- View the public cemetery map.
- Search publicly approved burial information.
- View the location of a selected burial plot.
- Access previously downloaded cemetery information while offline.

### Administrator
- Access protected management functions.
- Maintain burial records and plot information.
- Create and edit plot polygons.
- Verify changes before they become visible to visitors.
- Synchronize locally stored administrative changes with the central database.

The exact fields visible to visitors must be approved by the cemetery data owner. Information about deceased persons and their relatives must be handled carefully, and the system must not expose private or unnecessary personal details.

## 5. Functional Requirements

1. The system shall display the mapped cemetery.
2. The system shall allow visitors to search by a person's full or partial name.
3. The system shall return matching records rather than assuming names are unique.
4. The system shall provide approved distinguishing details, such as burial date or plot identifier, where available.
5. The system shall display the selected record's approved information.
6. The system shall highlight the individual burial plot associated with the selected record.
7. The system shall allow authorized administrators to create and update burial records.
8. The system shall allow authorized administrators to create and update individual burial plot polygons.
9. The system shall associate burial records with the correct plot.
10. The system shall validate required record fields and basic geometry constraints before accepting changes.
11. The system shall restrict administrative operations to authorized users.
12. The system shall allow users to download approved cemetery map data for offline use.
13. The system shall store approved burial records and plot geometries locally.
14. The system shall allow visitors to search locally stored burial records without internet connectivity.
15. The system shall display downloaded map information and cached burial plot polygons while offline.
16. The system shall queue supported administrative changes made offline.
17. The system shall synchronize pending changes with the central database when connectivity returns.
18. The system shall detect synchronization conflicts instead of silently overwriting newer server-side information.
19. The system shall display the synchronization status and last successful synchronization time.
20. The system shall distinguish between verified information and pending or unverified changes.

The database must allow more than one burial record to be associated with a plot if cemetery practices include shared or family plots. The implementation must not assume that every person always has a unique one-person-to-one-plot relationship.

## 6. Proposed Technology Stack

The following stack is proposed for an Android-first React Native application. Exact package versions and compatibility must be verified during the technical proof of concept.

| Component | Proposed Technology | Purpose |
|---|---|---|
| Mobile framework | React Native with Expo | Build the Android application |
| Programming language | TypeScript | Application logic and type safety |
| Code editor | VS Code or compatible editor | Write and manage project code |
| Map rendering | MapLibre React Native | Display and interact with the cemetery map |
| Geographic interchange | GeoJSON | Transfer plot polygons and geographic features |
| Local database | Expo SQLite | Persist cached burial records, plot geometries, and pending changes |
| Backend services | Supabase | Authentication and backend services |
| Database | PostgreSQL with PostGIS | Store authoritative records and spatial geometries |
| Networking | Fetch API or typed API client | Communicate with backend services |
| Android builds | Expo Application Services (EAS Build) | Generate installable Android APK/AAB files through cloud builds |
| Development testing | Expo development build | Test native MapLibre functionality on the physical Android device |

### 6.1 Development Environment

The project will be developed primarily using an Android phone running Kali NetHunter.

The intended development workflow is:

1. Install and configure Node.js and the necessary development tools in the NetHunter environment.
2. Use VS Code-compatible editing tools or a browser-based editor such as code-server.
3. Create and manage the React Native project using Expo.
4. Develop and test application logic using TypeScript.
5. Submit native Android builds to Expo's cloud build service.
6. Download the generated APK.
7. Install and test the APK directly on the Android device.

Android Studio will not be required for the intended cloud-build workflow. However, the compatibility of Node.js, Expo CLI, the development server, and the required dependencies within the NetHunter environment must be verified early.

MapLibre React Native uses native Android components and cannot be fully tested through Expo Go alone. A custom Expo development build is required.

### 6.2 Geographic Data Considerations

GeoJSON coordinates are generally expressed in WGS 84 (EPSG:4326). Area, distance, and geometry-accuracy calculations must not treat longitude and latitude degrees as ordinary planar meters. Appropriate projected coordinate systems or geodesic calculations must be used for measurement and validation.

The project must comply with OpenStreetMap attribution requirements and the usage policies of the selected tile provider. Public OpenStreetMap tile servers must not be assumed to provide unrestricted production or offline tile hosting.

Offline map downloads must use a provider and plan that explicitly permit the intended caching and offline use.

## 7. High-Level System Architecture

The system will use an Android mobile client connected to a backend, with local storage to support offline functionality.

1. The React Native application presents the map, search interface, and administrative screens.
2. The application communicates with backend services over authenticated network requests when connected.
3. PostgreSQL with PostGIS stores authoritative burial records, cemetery information, and plot geometries.
4. The backend enforces authorization and validates data before it is stored or returned.
5. The application stores an approved subset of burial records and plot geometries in a local SQLite database.
6. MapLibre React Native renders the map, plot polygons, and selected-plot highlighting.
7. An offline map area is downloaded in advance using MapLibre's offline-pack capability and a tile/style provider whose terms allow offline downloads.
8. A synchronization component uploads queued local changes when connectivity returns and retrieves server-side updates.

### 7.1 Offline Data Strategy

**Local Data Storage**

Expo SQLite will persist:
- Cached burial records.
- Plot identifiers.
- Approved burial information.
- Plot geometries.
- Downloaded-data version information.
- Pending administrative changes.
- Synchronization status.

The local database must remain available after the application is closed and reopened.

**Offline Map Access**

Users or administrators with appropriate permission will download the selected cemetery area before going offline.

The downloaded area should include:
- Required map tiles.
- Map styles.
- Supporting map resources.
- Cemetery geographic features.

The team must test that the offline map actually renders with network access disabled.

Tile-provider licensing, download limits, storage requirements, and attribution must be respected.

**Offline Search and Map Interaction**

Search will query the local SQLite dataset when the device is offline.

Selecting a cached result will:
1. Retrieve the locally stored burial record.
2. Display its approved information.
3. Retrieve the associated plot geometry.
4. Focus the map on the corresponding location.
5. Highlight the selected burial plot.

The application must clearly indicate that cached information may be outdated.

**Synchronization**

Each locally created or edited item will be stored with:
- A stable identifier.
- Operation type.
- Timestamp.
- Synchronization status.
- Version information where applicable.

When connectivity returns, the application will submit pending changes to the backend.

The backend remains the authoritative source of information.

The synchronization mechanism must detect conflicting edits rather than silently overwriting newer server-side data. Conflicts should be flagged for administrator review.

**Offline Editing Limitations**

Offline changes should initially be restricted to clearly defined administrative operations.

Changes to sensitive burial records or verified plot boundaries may require online confirmation or later administrator review.

The application must not present an unverified local edit as an authoritative public record before synchronization and approval.

The local database is a cache and temporary work area, not a replacement for the authoritative PostGIS database.

## 8. Preliminary Data Design

The final schema will be refined after examining the cemetery's actual records and mapping practices.

Expected entities include:

- **Cemetery:** cemetery identifier, name, location, and other approved details.
- **Section:** section identifier, cemetery identifier, name or code, and optional boundary geometry.
- **Burial Plot:** plot identifier, section identifier where applicable, polygon geometry, and status where verified.
- **Burial Record:** person identifier, name, approved burial details, and associated plot identifier.
- **User:** account identifier, role, and authentication-related information.
- **Change Record:** who made a change, what was changed, and when, where auditability is required.
- **Synchronization Record:** local operation identifier, associated record, operation type, timestamp, and synchronization status.

A plot may have multiple burial records if the cemetery's actual practices require it. The data model must reflect the verified real-world arrangement rather than impose an assumed relationship.

## 9. Geographic Data Collection and Accuracy Plan

Geographic accuracy is a major project dependency. The team must establish how individual plot boundaries can be obtained and verified before committing to detailed polygon mapping.

Potential sources include:

1. Official cemetery layout plans or plot inventories.
2. Existing records maintained by the cemetery administrator or local government.
3. Authorized field surveys using an appropriate measurement method.
4. Georeferenced imagery, but only where individual plot boundaries are genuinely identifiable and can be checked on site.

A normal phone GPS reading may be insufficient to establish precise boundaries for individual graves. The project must not claim survey-grade or centimeter-level accuracy unless the equipment and method actually support that claim.

### Proposed Workflow

1. Obtain permission to access and map the selected cemetery.
2. Secure the available layout plans, plot inventory, and burial records.
3. Determine a suitable coordinate reference system and mapping method.
4. Georeference available plans or collect field measurements as appropriate.
5. Digitize individual burial plots as polygons.
6. Assign plot identifiers and link records using verified information.
7. Check for invalid geometries, overlaps, gaps, misplaced features, and mismatched identifiers.
8. Have cemetery personnel or another qualified source verify the mapped information.
9. Mark uncertain or unverified features so they are not presented as confirmed data.

The project should begin with a manageable test area before mapping the entire cemetery.

## 10. User Interface Plan

### Visitor Interface
- Cemetery map screen.
- Search field supporting full and partial names.
- Search results list with distinguishing details.
- Burial information view.
- Map focus/highlight for the selected plot.
- Offline availability indicator.
- Last synchronization information.

### Administrator Interface
- Login screen.
- Dashboard.
- Burial record list and search.
- Add/edit burial record form.
- Map-based plot creation and editing interface.
- Plot and section information views, as applicable.
- Review or verification controls for mapped data.
- Pending synchronization list.
- Synchronization status and error information.

The interface should prioritize clear search results and an understandable map. It should not display fields that have not been approved for public access.

## 11. Development Methodology: Agile

The project will use the Agile Software Development Methodology, applying an iterative and incremental development process.

Instead of developing the entire application in one continuous phase, the system will be divided into manageable increments. Each increment will be planned, implemented, tested, reviewed, and refined.

Development will proceed through short iterations. At the end of each iteration, the team will review the working features, identify defects or changes, and update the prioritized development tasks.

Feedback from the adviser, intended users, and authorized cemetery representatives will be incorporated when available.

### 11.1 Agile Development Activities

Each iteration will generally follow this cycle:

1. **Planning:** Select the requirements and tasks to be completed in the iteration.
2. **Design:** Define the necessary interface, data structures, and technical approach.
3. **Implementation:** Develop the selected features.
4. **Testing:** Test the implemented features and correct defects.
5. **Review:** Demonstrate the working increment and gather relevant feedback.
6. **Refinement:** Update the backlog and plan the next iteration.

### 11.2 Proposed Development Iterations

| Iteration | Focus | Main Activities and Expected Output |
|---|---|---|
| 0. Feasibility and Technical Validation | Confirm project viability | Obtain initial permission and determine data availability; inspect sample cemetery records or layout plans; set up the React Native/Expo project in the intended NetHunter workflow; create a cloud development build; install it on the phone; verify MapLibre renders a sample GeoJSON polygon; test an offline map pack and local SQLite persistence. **Output:** documented feasibility findings and a working on-device prototype. |
| 1. Requirements and System Design | Establish the system foundation | Confirm user roles, functional requirements, privacy rules, data fields, offline use cases, synchronization rules, and mapping workflow; prepare use cases, interface designs, database design, and architecture. **Output:** reviewed requirements and initial system design. |
| 2. Application Foundation | Build the basic application | Set up navigation, application structure, backend connection, authentication, local SQLite database, and network-state handling. **Output:** running application with initial screens, local persistence, and backend connection. |
| 3. Cemetery Map and GIS Features | Implement map display and plot geometry | Integrate MapLibre React Native; display the selected cemetery map; load sample or verified GeoJSON features; render individual plot polygons; support selecting and highlighting a plot. **Output:** interactive cemetery map with selectable plot polygons. |
| 4. Offline Map and Data Access | Implement offline visitor workflow | Add offline map-area downloads; cache approved burial records and plot geometries in SQLite; implement offline name search and plot highlighting; show data freshness and offline status. **Output:** visitor map and search workflow that works after the device disconnects, provided the required data and map area were downloaded beforehand. |
| 5. Burial Information Management | Implement administrative records | Develop create, view, update, and management functions for burial records; implement plot identifiers and record-to-plot associations; add validation and access controls. **Output:** working burial record management module. |
| 6. Synchronization | Implement controlled offline changes | Add a pending-change queue, retry behavior, duplicate prevention, synchronization status, and conflict detection; define which offline administrative changes are allowed and which require review. **Output:** tested synchronization workflow for supported offline edits. |
| 7. Search, Navigation, and Integration | Complete the main workflows | Implement full and partial name search, multiple-match handling, approved distinguishing details, map navigation, and selected-plot highlighting; integrate mapping, records, authentication, offline storage, and synchronization. **Output:** integrated visitor and administrator workflows. |
| 8. Testing and Evaluation | Assess system quality | Conduct functional, usability, performance, security, offline, synchronization, and geographic-data checks; document results and defects. **Output:** test and evaluation results. |
| 9. Refinement and Finalization | Improve and prepare the system | Fix issues identified during testing; refine the interface and documentation; prepare final deployment and demonstration. **Output:** refined system and final project documentation. |

The iterations are a proposed sequence, not fixed calendar durations. Their length and exact contents may be adjusted based on the academic schedule, team capacity, and findings from each review.

High-risk dependencies—especially permission, access to burial records, plot-mapping accuracy, MapLibre compatibility, and offline map licensing—must be addressed early rather than postponed.

## 12. Testing and Evaluation Plan

Testing will be performed throughout development, not only at the end.

### Functional Testing

- Verify that visitors can search by full and partial names.
- Verify that multiple matching names are handled correctly.
- Verify that selecting a record displays the correct approved details.
- Verify that the correct plot is highlighted.
- Verify that administrators can perform permitted record and plot operations.
- Verify that unauthorized users cannot access administrative functions.

### GIS and Data Validation

- Check that plot polygons are valid and render in the correct location.
- Check plot identifiers against the source inventory.
- Inspect geometry overlaps, gaps, and misplaced features.
- Compare mapped features against the best available authoritative reference.
- Document the mapping method, reference data, and observed limitations.

### Offline and Synchronization Testing

- Download the approved cemetery map area and verify it remains available after closing and reopening the application.
- Disable network connectivity and verify the map, cached plot polygons, burial details, and name search still work.
- Verify that the application clearly identifies cached data and its last synchronization time.
- Make an allowed offline edit, reconnect, and verify that it synchronizes correctly.
- Simulate interrupted synchronization, retries, duplicate submissions, and conflicting edits.
- Verify that an unapproved or failed local change is not presented as an authoritative public record.

### Usability Testing

Intended visitors and authorized personnel may be asked to complete representative tasks, such as finding a burial record or updating a record.

Feedback will be collected using an appropriate evaluation instrument approved by the adviser or institution.

### Performance and Reliability Testing

- Measure map loading and search response times under representative conditions.
- Test behavior with realistic record and polygon counts.
- Test network interruption and recovery.
- Check data consistency after updates and synchronization.
- Measure local storage usage for cached records and offline map areas.

The evaluation criteria, instruments, respondent groups, and acceptance thresholds must be finalized with the adviser and based on the institution's research requirements.

## 13. Privacy, Security, and Ethical Considerations

- Obtain authorization before collecting, digitizing, or publishing cemetery records and geographic information.
- Confirm which burial details may be shown publicly.
- Collect and store only information necessary for the system's purpose.
- Restrict record editing and geometry changes to authorized personnel.
- Protect administrator accounts and backend access.
- Use test or anonymized data during development where appropriate.
- Maintain a record of administrative changes where required.
- Protect locally cached information and clear sensitive cached data when access is revoked, where applicable.
- Follow applicable institutional policies and Philippine data-protection requirements.

## 14. Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Cemetery permission is not granted | Project may not proceed as designed | Secure written or documented authorization before full implementation. |
| Burial records are incomplete or unavailable | Search and record management may lack reliable data | Inspect sample records early and agree on a permitted data source and minimum dataset. |
| Individual plot boundaries cannot be identified reliably | Map may be inaccurate or misleading | Test the mapping method on a small area and obtain an authoritative plan or suitable field measurements. |
| Map library or dependencies do not build in the chosen NetHunter workflow | Core GIS functionality may be blocked | Complete a cloud development build and on-device MapLibre proof of concept before building the full application; use a different development environment if necessary. |
| Offline map downloads are restricted by the tile provider | Offline map feature may be unusable or violate provider terms | Select a provider that permits the intended offline downloads; verify terms, attribution, and tile limits before implementation. |
| Offline data becomes stale or conflicts with server updates | Users may see outdated information or overwrite newer changes | Show last-sync status, use stable record identifiers and version checks, and flag conflicts for review. |
| Internet access is unreliable | Live updates and synchronization may be delayed | Cache approved records and map data in advance; queue permitted changes locally and retry synchronization safely. |
| Duplicate names cause incorrect selection | Visitor may locate the wrong burial | Show approved distinguishing details and require the visitor to select the intended match. |
| Incorrect edits damage records or geometry | Data integrity may be compromised | Add validation, authorization, backups, and change history where feasible. |
| Scope expands beyond available time | Core features may remain incomplete | Prioritize accurate mapping, burial management, name-based search, and essential offline access; defer nonessential features. |
| Phone storage becomes insufficient | Offline maps and cached data may not fit | Limit downloadable areas, allow users to remove downloaded map data, and monitor local storage usage. |

## 15. Immediate Action Checklist

Before substantial development begins:

1. Identify the cemetery that will serve as the initial study site.
2. Contact the responsible cemetery administrator or local government office.
3. Confirm whether the team may access the site and collect or digitize information.
4. Request sample burial records, plot inventories, and cemetery layout plans.
5. Confirm which burial information may be stored and displayed publicly.
6. Determine whether individual grave boundaries can be mapped with a defensible level of accuracy.
7. Set up the React Native and Expo development environment in NetHunter.
8. Verify that a cloud development build can be generated and installed on the target Android phone.
9. Test MapLibre polygon rendering and local SQLite persistence.
10. Test offline map downloads with a provider that permits offline use.
11. Review the project scope and methodology with the adviser.

## 16. First Technical Proof-of-Concept Acceptance Criteria

Before implementing the full application, create a small prototype that can:

- Be developed from the intended NetHunter environment using the available editor and command-line tools.
- Be submitted to the cloud build service and produce an installable Android development APK.
- Install and run on the target Android phone.
- Display a map using the selected map source through MapLibre React Native.
- Load and render at least one sample GeoJSON polygon.
- Allow the user to tap or select the polygon and display its plot identifier.
- Save and reload a sample burial record and polygon using SQLite.
- Download a small permitted offline map area.
- Continue displaying the downloaded map and locally stored polygon after network connectivity is disabled.
- Search the locally stored sample record while offline.

If this prototype cannot be built and tested reliably, resolve the tooling, library, offline-map, or device limitation before proceeding with the full system.

## 17. Project Principles

1. **Data before features:** Verify access to records and mapping sources before committing to the full feature set.
2. **Accuracy over appearance:** Do not present estimated or uncertain plot boundaries as verified locations.
3. **Incremental delivery:** Develop and test the system in working increments using Agile.
4. **Offline readiness:** Ensure essential visitor functions remain available when the device has no internet connection, provided the required data and map area were downloaded beforehand.
5. **Controlled synchronization:** Treat the central database as authoritative and handle conflicting offline changes explicitly.
6. **Minimum viable scope:** Prioritize the cemetery map, individual plot polygons, burial record management, name-based search, and offline viewing/search.
7. **Privacy by design:** Publish only information authorized for public access.
8. **Evidence-based evaluation:** Assess the system using documented tests and feedback rather than unsupported claims.
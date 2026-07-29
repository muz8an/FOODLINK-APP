# NGO Accept & Volunteer Notification Popup - Implementation

## Plan
1. **NGO Accept Flow Change**: Set status to `accepted` (not `volunteer_assigned`), store `accepted_by` as NGO's ID, notify ALL volunteers
2. **PickupAlertModal Component**: Create full-screen modal showing from→to (donor pickup → NGO delivery) with "Claim Assignment" button
3. **VolunteerViews Enhancement**: Show from→to info clearly, add claim button, show pickup alert popup for new accepted donations
4. **Data Persistence Fix**: Ensure accepted donations properly load on refresh

## Implementation Steps
- [x] Plan approved by user
- [x] Step 1: Modify `handleAccept` in NGOViews - change to `accepted` status, notify ALL volunteers
- [x] Step 2: Add `pickupAlerts` to Zustand store (store.ts)
- [x] Step 3: Add `PickupAlertModal` component with from→to pickup details
- [x] Step 4: Enhance `VolunteerViews` - show from→to, claim button, pickup alert popup + realtime subscription
- [x] Step 5: Fix re-render loop with useRef for alerted IDs
- [x] Implementation complete - verified all changes


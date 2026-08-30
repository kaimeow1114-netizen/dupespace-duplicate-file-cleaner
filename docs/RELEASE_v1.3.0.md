# DUPESPACE v1.3.0

- Native virtual group cards, ordered by video, image and important documents, replace the flat review table.
- Each group has one bounded keeper image preview. Clicking a filename opens a non-modal details pane;
  checkbox clicks and double clicks never open previews.
- All safe trash-eligible copies, including small files and verified mirror folders, are selected after
  every desktop/web scan. Trash runs on one explicit click. Keepers, protected/project files and locked
  contexts remain excluded; permanent deletion still clears selection and requires high-risk confirmation.
- Folder rows have direct X removal from scan scope. Saved locations support one-click load, inline rename,
  edit and removal, with first-folder default names and truncated folder previews.
- Sidebar collapse control is aligned; scan messages rotate in the large title without hiding real paths.
- CSV audit, revalidation, safe stop and no trash-to-permanent fallback are unchanged.

Preview and interaction QA uses synthetic records and dedicated fixture folders, never user data.
Windows installer retains the existing AppId and supports in-app update discovery.

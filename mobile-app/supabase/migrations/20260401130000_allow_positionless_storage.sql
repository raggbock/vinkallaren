-- Allow storage spaces without positions (e.g. party coolers, open shelves)
alter table storage_spaces drop constraint if exists storage_spaces_row_count_check;
alter table storage_spaces add constraint storage_spaces_row_count_check check (row_count >= 0);

alter table storage_spaces drop constraint if exists storage_spaces_slots_per_row_check;
alter table storage_spaces add constraint storage_spaces_slots_per_row_check check (slots_per_row >= 0);

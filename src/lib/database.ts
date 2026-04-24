// Database CRUD operations for database pages, properties, rows, views.
// Uses the browser Supabase client for client-side mutations.

import { createClient } from "@/lib/supabase/client";
import { captureSupabaseError } from "@/lib/sentry";
import {
  getDatabaseCache,
  setDatabaseCache,
  invalidateDatabase,
  getMembersCache,
  setMembersCache,
} from "@/lib/database-cache";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
  DatabaseViewConfig,
  DatabaseViewType,
  Page,
  PropertyType,
  RowValue,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClient() {
  return createClient();
}

/**
 * Get the next position value for an ordered table.
 * Queries the max position for the given parent and returns max + 1.
 */
async function nextPosition(
  table: "database_properties" | "database_views",
  parentColumn: "database_id",
  parentId: string,
): Promise<number> {
  const supabase = getClient();
  const { data } = await supabase
    .from(table)
    .select("position")
    .eq(parentColumn, parentId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? data.position + 1 : 0;
}

/**
 * Get the next position for a child page (row) within a database.
 */
async function nextPagePosition(parentId: string): Promise<number> {
  const supabase = getClient();
  const { data } = await supabase
    .from("pages")
    .select("position")
    .eq("parent_id", parentId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? data.position + 1 : 0;
}

// ---------------------------------------------------------------------------
// Database CRUD
// ---------------------------------------------------------------------------

export interface CreateDatabaseResult {
  page: Page;
  property: DatabaseProperty;
  view: DatabaseView;
}

/**
 * Create a database page with a default "Title" property and "Default view" table view.
 * If any step fails, the created page is cleaned up.
 */
export async function createDatabase(
  workspaceId: string,
  userId: string,
  title?: string,
): Promise<{ data: CreateDatabaseResult | null; error: Error | null }> {
  const supabase = getClient();

  // 1. Create the database page
  const { data: page, error: pageError } = await supabase
    .from("pages")
    .insert({
      workspace_id: workspaceId,
      title: title ?? "Untitled Database",
      is_database: true,
      position: 0,
      created_by: userId,
    })
    .select()
    .single();

  if (pageError) {
    captureSupabaseError(pageError, "database.create:page");
    return { data: null, error: pageError };
  }

  // 2. Create default "Title" text property
  const { data: property, error: propError } = await supabase
    .from("database_properties")
    .insert({
      database_id: page.id,
      name: "Title",
      type: "text",
      config: {},
      position: 0,
    })
    .select()
    .single();

  if (propError) {
    captureSupabaseError(propError, "database.create:property");
    // Clean up the page
    await supabase.from("pages").delete().eq("id", page.id);
    return { data: null, error: propError };
  }

  // 3. Create default table view
  const { data: view, error: viewError } = await supabase
    .from("database_views")
    .insert({
      database_id: page.id,
      name: "Default view",
      type: "table",
      config: {},
      position: 0,
    })
    .select()
    .single();

  if (viewError) {
    captureSupabaseError(viewError, "database.create:view");
    // Clean up the page (cascades to property)
    await supabase.from("pages").delete().eq("id", page.id);
    return { data: null, error: viewError };
  }

  return {
    data: {
      page: page as Page,
      property: property as DatabaseProperty,
      view: view as DatabaseView,
    },
    error: null,
  };
}

/**
 * Soft-delete a database page. Cascading FK constraints handle
 * properties, views, and row values when the page is eventually purged.
 */
export async function deleteDatabase(
  pageId: string,
): Promise<{ error: Error | null }> {
  const supabase = getClient();
  const { error } = await supabase
    .from("pages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", pageId)
    .eq("is_database", true);

  if (error) {
    captureSupabaseError(error, "database.delete");
  }
  return { error };
}

// ---------------------------------------------------------------------------
// Property CRUD
// ---------------------------------------------------------------------------

/**
 * Add a new property (column) to a database.
 */
export async function addProperty(
  databaseId: string,
  name: string,
  type: PropertyType,
  config?: Record<string, unknown>,
): Promise<{ data: DatabaseProperty | null; error: Error | null }> {
  const supabase = getClient();
  const position = await nextPosition(
    "database_properties",
    "database_id",
    databaseId,
  );

  const { data, error } = await supabase
    .from("database_properties")
    .insert({
      database_id: databaseId,
      name,
      type,
      config: config ?? {},
      position,
    })
    .select()
    .single();

  if (error) {
    captureSupabaseError(error, "database.addProperty");
    return { data: null, error };
  }
  invalidateDatabase(databaseId);
  return { data: data as DatabaseProperty, error: null };
}

/**
 * Update a property: rename, change type, or update config.
 */
export async function updateProperty(
  propertyId: string,
  updates: Partial<Pick<DatabaseProperty, "name" | "type" | "config">>,
  databaseId?: string,
): Promise<{ data: DatabaseProperty | null; error: Error | null }> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("database_properties")
    .update(updates)
    .eq("id", propertyId)
    .select()
    .single();

  if (error) {
    captureSupabaseError(error, "database.updateProperty");
    return { data: null, error };
  }
  if (databaseId) invalidateDatabase(databaseId);
  return { data: data as DatabaseProperty, error: null };
}

/**
 * Delete a property. Cascades to row_values for that property via FK.
 */
export async function deleteProperty(
  propertyId: string,
  databaseId?: string,
): Promise<{ error: Error | null }> {
  const supabase = getClient();
  const { error } = await supabase
    .from("database_properties")
    .delete()
    .eq("id", propertyId);

  if (error) {
    captureSupabaseError(error, "database.deleteProperty");
  } else if (databaseId) {
    invalidateDatabase(databaseId);
  }
  return { error };
}

/**
 * Reorder properties by updating their position values.
 * `orderedIds` is the desired order — index becomes the new position.
 */
export async function reorderProperties(
  databaseId: string,
  orderedIds: string[],
): Promise<{ error: Error | null }> {
  const supabase = getClient();

  // Update each property's position in sequence.
  // Supabase JS doesn't support batch updates with different values per row,
  // so we issue individual updates. The number of properties per database
  // is small (typically < 20), so this is acceptable.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("database_properties")
      .update({ position: i })
      .eq("id", orderedIds[i])
      .eq("database_id", databaseId);

    if (error) {
      captureSupabaseError(error, "database.reorderProperties");
      return { error };
    }
  }

  invalidateDatabase(databaseId);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Row CRUD
// ---------------------------------------------------------------------------

/**
 * Add a row to a database. Creates a child page and optionally sets initial values.
 * `initialValues` maps property_id → value jsonb.
 */
export async function addRow(
  databaseId: string,
  userId: string,
  initialValues?: Record<string, Record<string, unknown>>,
): Promise<{ data: Page | null; error: Error | null }> {
  const supabase = getClient();

  // Look up the workspace_id from the database page
  const { data: dbPage, error: dbError } = await supabase
    .from("pages")
    .select("workspace_id")
    .eq("id", databaseId)
    .single();

  if (dbError) {
    captureSupabaseError(dbError, "database.addRow:lookup");
    return { data: null, error: dbError };
  }

  const position = await nextPagePosition(databaseId);

  const { data: rowPage, error: rowError } = await supabase
    .from("pages")
    .insert({
      workspace_id: dbPage.workspace_id,
      parent_id: databaseId,
      title: "",
      is_database: false,
      position,
      created_by: userId,
    })
    .select()
    .single();

  if (rowError) {
    captureSupabaseError(rowError, "database.addRow:page");
    return { data: null, error: rowError };
  }

  // Insert initial values if provided.
  // Guard: reject non-plain objects (e.g. a MouseEvent leaked from an onClick handler).
  const safeValues =
    initialValues &&
    typeof initialValues === "object" &&
    !Array.isArray(initialValues) &&
    Object.getPrototypeOf(initialValues) === Object.prototype
      ? initialValues
      : undefined;

  if (safeValues && Object.keys(safeValues).length > 0) {
    const rows = Object.entries(safeValues).map(
      ([propertyId, value]) => ({
        row_id: rowPage.id,
        property_id: propertyId,
        value,
      }),
    );

    const { error: valError } = await supabase
      .from("row_values")
      .insert(rows);

    if (valError) {
      captureSupabaseError(valError, "database.addRow:values");
      // Row page was created but values failed — don't roll back the page,
      // the user can still edit values later.
    }
  }

  invalidateDatabase(databaseId);
  return { data: rowPage as Page, error: null };
}

/**
 * Upsert a cell value for a row + property combination.
 */
export async function updateRowValue(
  rowId: string,
  propertyId: string,
  value: Record<string, unknown>,
  databaseId?: string,
): Promise<{ data: RowValue | null; error: Error | null }> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("row_values")
    .upsert(
      { row_id: rowId, property_id: propertyId, value },
      { onConflict: "row_id,property_id" },
    )
    .select()
    .single();

  if (error) {
    return { data: null, error };
  }
  if (databaseId) invalidateDatabase(databaseId);
  return { data: data as RowValue, error: null };
}

// ---------------------------------------------------------------------------
// View CRUD
// ---------------------------------------------------------------------------

/**
 * Add a new view to a database.
 */
export async function addView(
  databaseId: string,
  name: string,
  type: DatabaseViewType,
  config?: DatabaseViewConfig,
): Promise<{ data: DatabaseView | null; error: Error | null }> {
  const supabase = getClient();
  const position = await nextPosition(
    "database_views",
    "database_id",
    databaseId,
  );

  const { data, error } = await supabase
    .from("database_views")
    .insert({
      database_id: databaseId,
      name,
      type,
      config: config ?? {},
      position,
    })
    .select()
    .single();

  if (error) {
    captureSupabaseError(error, "database.addView");
    return { data: null, error };
  }
  invalidateDatabase(databaseId);
  return { data: data as DatabaseView, error: null };
}

/**
 * Update a view's name or config.
 */
export async function updateView(
  viewId: string,
  updates: Partial<Pick<DatabaseView, "name" | "type" | "config">>,
  databaseId?: string,
): Promise<{ data: DatabaseView | null; error: Error | null }> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("database_views")
    .update(updates)
    .eq("id", viewId)
    .select()
    .single();

  if (error) {
    captureSupabaseError(error, "database.updateView");
    return { data: null, error };
  }
  if (databaseId) invalidateDatabase(databaseId);
  return { data: data as DatabaseView, error: null };
}

/**
 * Delete a view. Rejects if it's the last view for the database.
 */
export async function deleteView(
  viewId: string,
  databaseId?: string,
): Promise<{ error: Error | null }> {
  const supabase = getClient();

  // Look up the database_id to check view count
  const { data: view, error: lookupError } = await supabase
    .from("database_views")
    .select("database_id")
    .eq("id", viewId)
    .single();

  if (lookupError) {
    captureSupabaseError(lookupError, "database.deleteView:lookup");
    return { error: lookupError };
  }

  // Count views for this database
  const { count, error: countError } = await supabase
    .from("database_views")
    .select("id", { count: "exact", head: true })
    .eq("database_id", view.database_id);

  if (countError) {
    captureSupabaseError(countError, "database.deleteView:count");
    return { error: countError };
  }

  if (count !== null && count <= 1) {
    const err = new Error("Cannot delete the last view of a database");
    return { error: err };
  }

  const { error } = await supabase
    .from("database_views")
    .delete()
    .eq("id", viewId);

  if (error) {
    captureSupabaseError(error, "database.deleteView");
  } else {
    invalidateDatabase(databaseId ?? view.database_id);
  }
  return { error };
}

/**
 * Reorder views by updating their position values.
 */
export async function reorderViews(
  databaseId: string,
  orderedIds: string[],
): Promise<{ error: Error | null }> {
  const supabase = getClient();

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("database_views")
      .update({ position: i })
      .eq("id", orderedIds[i])
      .eq("database_id", databaseId);

    if (error) {
      captureSupabaseError(error, "database.reorderViews");
      return { error };
    }
  }

  invalidateDatabase(databaseId);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Workspace Members (for person and created_by property rendering)
// ---------------------------------------------------------------------------

export interface WorkspaceMember {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
}

/**
 * Load workspace members with profile data. Used to populate _members config
 * on person and created_by properties so renderers can resolve user IDs.
 * Results are cached in-memory for 30s.
 */
export async function loadWorkspaceMembers(
  workspaceId: string,
): Promise<{ data: WorkspaceMember[] | null; error: Error | null }> {
  const cached = getMembersCache<WorkspaceMember[]>(workspaceId);
  if (cached) {
    return { data: cached, error: null };
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from("members")
    .select(
      "user_id, profiles!members_user_id_fkey(id, display_name, email, avatar_url)",
    )
    .eq("workspace_id", workspaceId);

  if (error) {
    captureSupabaseError(error, "database.loadWorkspaceMembers");
    return { data: null, error };
  }

  const members: WorkspaceMember[] = (data ?? []).map((m) => {
    const profile = m.profiles as unknown as {
      id: string;
      display_name: string;
      email: string;
      avatar_url: string | null;
    };
    return {
      id: m.user_id,
      display_name: profile.display_name,
      email: profile.email,
      avatar_url: profile.avatar_url,
    };
  });

  setMembersCache(workspaceId, members);

  return { data: members, error: null };
}

// ---------------------------------------------------------------------------
// Data Loading
// ---------------------------------------------------------------------------

export interface LoadDatabaseResult {
  properties: DatabaseProperty[];
  views: DatabaseView[];
  rows: DatabaseRow[];
}

/**
 * Load a database: properties, views, and rows with their values in parallel.
 * Results are cached in-memory for 30s to avoid re-fetching on back-navigation.
 */
export async function loadDatabase(
  databaseId: string,
): Promise<{ data: LoadDatabaseResult | null; error: Error | null }> {
  const cached = getDatabaseCache<LoadDatabaseResult>(databaseId);
  if (cached) {
    return { data: cached, error: null };
  }

  const supabase = getClient();

  const [propertiesResult, viewsResult, rowsResult] = await Promise.all([
    supabase
      .from("database_properties")
      .select("*")
      .eq("database_id", databaseId)
      .order("position"),
    supabase
      .from("database_views")
      .select("*")
      .eq("database_id", databaseId)
      .order("position"),
    supabase
      .from("pages")
      .select("id, title, icon, cover_url, created_at, updated_at, created_by")
      .eq("parent_id", databaseId)
      .is("deleted_at", null)
      .order("position"),
  ]);

  if (propertiesResult.error) {
    captureSupabaseError(propertiesResult.error, "database.load:properties");
    return { data: null, error: propertiesResult.error };
  }
  if (viewsResult.error) {
    captureSupabaseError(viewsResult.error, "database.load:views");
    return { data: null, error: viewsResult.error };
  }
  if (rowsResult.error) {
    captureSupabaseError(rowsResult.error, "database.load:rows");
    return { data: null, error: rowsResult.error };
  }

  const properties = propertiesResult.data as DatabaseProperty[];
  const views = viewsResult.data as DatabaseView[];
  const rowPages = rowsResult.data as Pick<
    Page,
    "id" | "title" | "icon" | "cover_url" | "created_at" | "updated_at" | "created_by"
  >[];

  // Load all row values for these rows in a single query
  const rowIds = rowPages.map((r) => r.id);
  let allValues: RowValue[] = [];

  if (rowIds.length > 0) {
    const { data: valuesData, error: valuesError } = await supabase
      .from("row_values")
      .select("*")
      .in("row_id", rowIds);

    if (valuesError) {
      captureSupabaseError(valuesError, "database.load:values");
      return { data: null, error: valuesError };
    }
    allValues = valuesData as RowValue[];
  }

  // Group values by row_id, keyed by property_id
  const valuesByRow = new Map<string, Record<string, RowValue>>();
  for (const val of allValues) {
    let rowMap = valuesByRow.get(val.row_id);
    if (!rowMap) {
      rowMap = {};
      valuesByRow.set(val.row_id, rowMap);
    }
    rowMap[val.property_id] = val;
  }

  const rows: DatabaseRow[] = rowPages.map((page) => ({
    page,
    values: valuesByRow.get(page.id) ?? {},
  }));

  const result: LoadDatabaseResult = { properties, views, rows };
  setDatabaseCache(databaseId, result);

  return {
    data: result,
    error: null,
  };
}

/**
 * Load a single row with all its values, joined with property type info.
 */
export async function loadRow(
  rowId: string,
): Promise<{ data: DatabaseRow | null; error: Error | null }> {
  const supabase = getClient();

  const [pageResult, valuesResult] = await Promise.all([
    supabase
      .from("pages")
      .select("id, title, icon, cover_url, created_at, updated_at, created_by")
      .eq("id", rowId)
      .single(),
    supabase
      .from("row_values")
      .select("*")
      .eq("row_id", rowId),
  ]);

  if (pageResult.error) {
    captureSupabaseError(pageResult.error, "database.loadRow:page");
    return { data: null, error: pageResult.error };
  }
  if (valuesResult.error) {
    captureSupabaseError(valuesResult.error, "database.loadRow:values");
    return { data: null, error: valuesResult.error };
  }

  const values: Record<string, RowValue> = {};
  for (const val of valuesResult.data as RowValue[]) {
    values[val.property_id] = val;
  }

  return {
    data: {
      page: pageResult.data as Pick<
        Page,
        "id" | "title" | "icon" | "cover_url" | "created_at" | "updated_at" | "created_by"
      >,
      values,
    },
    error: null,
  };
}

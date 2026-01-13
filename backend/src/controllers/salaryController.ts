import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { parsePagination, buildPaginationMeta } from "../utils/pagination";

type AuthedRequest = Request & { user?: { id?: number } };
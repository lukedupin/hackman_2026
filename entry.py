import json

from fastapi import APIRouter, Request

from flowster import FlowSheet, FlowProfile

FLOW_PROFILE = None
SKIP = {}

def setup( settings ):
    global FLOW_PROFILE, SKIP
    FLOW_PROFILE = FlowProfile(settings.FLOW_PROFILE)
    SKIP = settings.SKIP

def gen_flow_sheet( header=None ):
    with open("hackman/meta.json") as handle:
        meta = json.load(handle)
        return FlowSheet(
            meta['title'],
            None,
            FLOW_PROFILE )

api_router = APIRouter()


@api_router.get("/status")
async def status():
    return {"successful": True, "app": "hackman"}


@api_router.post("/echo")
async def echo(request: Request):
    body = await request.json()
    message: str = body.get('message', '')

    return {"successful": True, "message": message}

# traffic/models.py
from mongoengine import Document, EmbeddedDocument
from mongoengine.fields import (
    StringField, FloatField, IntField, BooleanField,
    DictField, DateTimeField, ReferenceField
)
from datetime import datetime


class Node(Document):
    """Traffic node (intersection/signal)"""
    node_id = StringField(required=True, unique=True)
    name = StringField(required=True, max_length=200)
    location = DictField()  # {"lat": 12.34, "lng": 56.78}
    cycle_time = IntField(default=None)  # seconds; None → auto (30 × n_edges)
    is_active = BooleanField(default=True)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    
    meta = {
        'collection': 'nodes',
        'indexes': ['node_id', 'is_active']
    }
    
    def __str__(self):
        return f"{self.node_id} - {self.name}"



ROAD_TYPE_SPEEDS = {
    # free-flow speed in m/s for each road type
    "arterial":  13.9,   # 50 km/h
    "collector":  8.3,   # 30 km/h
    "local":      5.6,   # 20 km/h
}


class Edge(Document):
    """Edge with traffic metrics for both directions"""
    edge_id = StringField(required=True, unique=True)
    name = StringField(max_length=200)

    in_node_id  = StringField(required=True)
    out_node_id = StringField(required=True)

    # Road properties (existing)
    camera_id     = StringField(required=True)
    road_length_m = FloatField(required=True)
    road_width_m  = FloatField(required=True)

    # --- NEW: Tier 1 (cost formula is physically wrong without these) ---

    road_type = StringField(
        required=True,
        choices=["arterial", "collector", "local"],
        default="arterial"
    )
    # Free-flow speed in m/s. Derive from road_type via ROAD_TYPE_SPEEDS,
    # or override if you have actual posted speed signs per edge.
    speed_limit_ms = FloatField(required=True, default=13.9)

    # Number of lanes in the direction of travel (in_node → out_node).
    num_lanes = IntField(required=True, default=1, min_value=1)

    # Grade (slope) in percent. Positive = uphill in direction of travel.
    grade_pct = FloatField(default=0.0)

    # Fixed time penalty in seconds for a turn at the out_node junction.
    turn_penalty_s = FloatField(default=0.0)

    # Traffic metrics — outgoing direction only (in_node → out_node).
    # Filled by the ML pipeline (green endpoint) on every cycle.
    outgoing_traffic = DictField(default={
        'total_vehicles': 0,
        'queue_length_m': 0.0,
        'density': 0.0,
        'last_green_ts': 0,
    })

    is_active  = BooleanField(default=True)
    created_at = DateTimeField(default=datetime.now)

    meta = {
        'collection': 'edges',
        'strict': False,   # ignore old fields (e.g. incoming_traffic, capacity_veh_per_h)
                           # still present in MongoDB documents from before schema cleanup
    }


    def save(self, *args, **kwargs):
        # Auto-derive speed from road_type if not explicitly overridden
        if self.speed_limit_ms is None:
            self.speed_limit_ms = ROAD_TYPE_SPEEDS.get(self.road_type, 13.9)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.edge_id}: {self.in_node_id} → {self.out_node_id} [{self.road_type}, {self.num_lanes}L]"
    

class RoutingEntry(Document):
    """
    Distance-vector routing state
    """
    from_node_id = StringField(required=True)
    destination_node_id = StringField(required=True)
    next_hop_node_id = StringField(required=True)

    cost = FloatField(required=True)
    last_updated = DateTimeField(default=datetime.now)

    meta = {
        'collection': 'routing_table',
        'indexes': [
            {
                'fields': (
                    'from_node_id',
                    'destination_node_id',
                    'next_hop_node_id'
                ),
                'unique': True,
                'name': 'unique_route_idx'
            },
            {
                'fields': ['from_node_id'],
                'name': 'from_idx'
            },
            {
                'fields': ['destination_node_id'],
                'name': 'dest_idx'
            }
        ]
    }

  
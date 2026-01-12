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
    is_active = BooleanField(default=True)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    
    meta = {
        'collection': 'nodes',
        'indexes': ['node_id', 'is_active']
    }
    
    def __str__(self):
        return f"{self.node_id} - {self.name}"


class Edge(Document):
    """Edge with traffic metrics for both directions"""
    edge_id = StringField(required=True, unique=True)
    name = StringField(max_length=200)
    #CYCLE TIME!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!??????????????????????????????????????
    
    # Connected nodes (store IDs)
    #FOR AN EDGE FROM_NODE IS DA INCMONG NODE TO_NODE IS DA OUTGOING NODE
    in_node_id = StringField(required=True)
    out_node_id = StringField(required=True)
    
    # Road properties
    camera_id = StringField(required=True)
    road_length_m = FloatField(required=True)
    road_width_m = FloatField(required=True)
    
    # Traffic metrics for incoming direction
    incoming_traffic = DictField(default={
       
        'total_vehicles': 0,
        'queue_length_m': 0.0,
        'density': 0.0,
        'pressure': 0.0,
        'last_green_ts': 0,
        'last_update_ts': 0
    })
    
    # Traffic metrics for outgoing direction
    outgoing_traffic = DictField(default={

        'total_vehicles': 0,
        'queue_length_m': 0.0,
        'density': 0.0,
        'pressure': 0.0,
        'last_green_ts': 0,
        'last_update_ts': 0
    })
    
    is_active = BooleanField(default=True)
    created_at = DateTimeField(default=datetime.now)
    
    meta = {
        'collection': 'edges',
    }
    
    def __str__(self):
        return f"{self.edge_id}: {self.in_node_id} → {self.out_node_id}"

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

  
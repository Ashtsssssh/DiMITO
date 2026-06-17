from django.urls import path
from .views import (
    process_green_signal,
    create_node, delete_node, update_node, list_nodes,
    create_edge, delete_edge, update_edge, list_edges,
    update_edge_traffic, seed_all_traffic,
    get_routing_table, trigger_dv_iteration,
    create_routing_entry, get_signal_state,
    clear_database,
)

urlpatterns = [

    # CLIENT == NODE
    path("green/<str:node_id>/<str:edge_id>/", process_green_signal),
    path("gettable/node/<str:node_id>/", get_routing_table),
    path("signal/<str:node_id>/", get_signal_state),

    path("add_routing_entry/", create_routing_entry),

    # CLIENT == ADMIN

    path("node/add", create_node),
    path("node/edit", update_node),
    path("node/del", delete_node),
    path("node/get_all", list_nodes),

    path("edge/add", create_edge),
    path("edge/edit", update_edge),
    path("edge/del", delete_edge),
    path("edge/get_all", list_edges),

    path("edge/update/<str:edge_id>/<str:node_id>/", update_edge_traffic),

    # AUTOCALL IN FUTURE DV
    path("routing/dv-update-test/", trigger_dv_iteration),

    # TESTING PURPOSES
    path("edge/update", seed_all_traffic),

    # DATABASE MANAGEMENT
    path("db/clear-all/", clear_database),
]
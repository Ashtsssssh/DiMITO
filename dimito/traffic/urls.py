from django.urls import path
from .views import (
    calculate_green, add_node, add_edge, update_traffic,
    get_table, dv_update_test,
    create_test_network, verify_routing, add_routing_entry_view,get_signal_state,get_snapshot,edit_node,del_node,get_all_nodes,get_all_edges,edit_edge,del_edge
)

urlpatterns = [

    # CLIENT == NODE 
    path("green/<str:node_id>/", calculate_green),
    path("gettable/node/<str:node_id>/", get_table),
    path("signal/<str:node_id>/", get_signal_state),
    path("snapshot/", get_snapshot),


    path("add_routing_entry/", add_routing_entry_view),
    
    # CLIENT == ADMIN
    path("node/add", add_node), 
    path("node/edit", edit_node), 
    path("node/del", del_node), 
    path("node/get_all", get_all_nodes), 

    path("edge/add", add_edge),
    path("edge/edit", edit_edge), 
    path("edge/del", del_edge), 
    path("edge/get_all", get_all_edges), 

    path("edge/update/<str:edge_id>/<str:node_id>/", update_traffic),
    
    # AUTOCALL IN FUTURE DV
    path("routing/dv-update-test/", dv_update_test),
    
    # # Testing & Debug (keep these - they're useful!)
    # path("test/create-network/", create_test_network),
    # path("test/verify/", verify_routing),
  
]
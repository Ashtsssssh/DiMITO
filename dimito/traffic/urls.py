from django.urls import path
from .views import (
    calculate_green, add_node, add_edge, update_traffic,
    get_table, dv_update_test,
    create_test_network, verify_routing, add_routing_entry_view
)

urlpatterns = [

    # CLIENT == NODE 
    path("green/<str:node_id>/", calculate_green),
    path("gettable/node/<str:node_id>/", get_table),

    path("add_routing_entry/", add_routing_entry_view),
    
    # CLIENT == ADMIN
    path("node/", add_node),
    path("edge/", add_edge),
    path("edge/update/<str:edge_id>/<str:node_id>/", update_traffic),
    
    # AUTOCALL IN FUTURE DV
    path("routing/dv-update-test/", dv_update_test),
    
    # Testing & Debug (keep these - they're useful!)
    path("test/create-network/", create_test_network),
    path("test/verify/", verify_routing),
  
]
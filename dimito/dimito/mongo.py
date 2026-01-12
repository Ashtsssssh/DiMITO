from mongoengine import connect

def connect_mongo():
    connect(
        db="dimito",
        host="mongodb://localhost:27017/dimito"
    )

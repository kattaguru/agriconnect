"""
AgriConnect 1-Command Demo Reset Script
Resets the SQLite database tables and restores clean baseline seed data:
- Platform Admin (admin@agriconnect.com)
- Ravi Kumar (Farmer) with Sri Venkateswara Groundnut Farm
- Suresh Naidu (Worker) with harvesting skills
- Lakshmi Devi (Worker) with transplanting skills
- Anil Varma (Hybrid) with Sri Krishna Mixed Farm
"""

from app.database import engine, Base, SessionLocal
from app.seed import seed_demo_data

def reset_database():
    print("Dropping existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("Recreating database tables...")
    Base.metadata.create_all(bind=engine)
    
    with SessionLocal() as db:
        print("Seeding baseline demo accounts and data...")
        users = seed_demo_data(db)
        print("Demo database reset successfully!")
        for key, u in users.items():
            print(f"  - [{u['role']}] {u['name']} ({u['email']})")

if __name__ == "__main__":
    reset_database()

import boto3
import json
from botocore.exceptions import ClientError


# Function to add a user to a specified Cognito group
def add_user_to_group(cognito, username, group_name, user_pool_id):
    try:
        # Attempt to add the user to the specified group
        response = cognito.admin_add_user_to_group(
            UserPoolId=user_pool_id, Username=username, GroupName=group_name
        )
        print(f"Successfully added user {username} to group {group_name}")
        return response
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "UnknownError")
        print(
            f"Error adding user {username} to group {group_name}. Error code: {error_code}"  # noqa: E501
        )
        # Only raise the exception if it's not a ResourceNotFoundException
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            # ignore roles that do not exist.
            raise e


# Lambda handler function triggered post-confirmation/authentication
def handler(event, context):
    print("Post Confirmation/Authentication Lambda Triggered")
    print(f"Full event: {json.dumps(event)}")
    
    user_attributes = event["request"]["userAttributes"]
    print(f"User attributes: {user_attributes}")

    # For federated users, the username will be the "sub" from the IdP
    username = event["request"]["userAttributes"]["sub"]
    user_pool_id = event["userPoolId"]

    try:
        # Check if the user attributes are present, indicating a federated user
        if event["request"]["userAttributes"]:
            print(f"Federated User Signed In")
            cognito = boto3.client("cognito-idp")

            # Try to extract isMemberOf from different possible locations
            # 1. Check if it's in custom:isMemberOf (if mapped)
            # 2. Check if it's in isMemberOf directly
            # 3. Check in validationData or clientMetadata
            is_member_of = (
                user_attributes.get("custom:isMemberOf") or 
                user_attributes.get("isMemberOf") or
                event.get("request", {}).get("clientMetadata", {}).get("isMemberOf") or
                "[]"
            )
            
            print(f"isMemberOf value: {is_member_of}")
            
            try:
                # Try to parse as JSON in case it's a JSON array
                member_groups = json.loads(is_member_of) if is_member_of else []
                if isinstance(member_groups, str):
                    # If it's a string after parsing, convert to list
                    member_groups = [member_groups]
            except (json.JSONDecodeError, TypeError):
                # If not valid JSON, treat it as a comma-separated string or single value
                member_groups = [g.strip() for g in is_member_of.split(",")] if is_member_of else []
            
            print(f"Parsed member groups: {member_groups}")
            
            # Check if user is a member of SG_AB_LAUNCHPADAI
            is_approved_user = "SG_AB_LAUNCHPADAI" in member_groups
            print(f"Has SG_AB_LAUNCHPADAI? {is_approved_user}")
            
            if is_approved_user:
                # Add user to chatbot_user group
                add_user_to_group(
                    cognito=cognito,
                    username=username,
                    group_name="chatbot_user",
                    user_pool_id=user_pool_id,
                )
            else:
                print(f"User {username} does not have SG_AB_LAUNCHPADAI security group. Not adding to chatbot_user group.")
                
    except Exception as error:
        print(f"Error: {error}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")

    # Set the final user status to CONFIRMED
    event['response']['finalUserStatus'] = 'CONFIRMED'
    print("Returning event")
    return event
    
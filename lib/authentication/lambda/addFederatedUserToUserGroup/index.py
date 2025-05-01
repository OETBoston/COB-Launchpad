import boto3
from botocore.exceptions import ClientError

# def get_user_groups(cognito, username, user_pool_id):
#     try:
#         groups = []
#         pagination_token = None
#         page_count = 0
#         max_pages = 100

#         while True:
#             if page_count >= max_pages:
#                 print(f"Reached maximum number of pages ({max_pages})")
#                 break

#             kwargs = {"Username": username, "UserPoolId": user_pool_id}
#             if pagination_token:
#                 kwargs["NextToken"] = pagination_token

#             response = cognito.admin_list_groups_for_user(**kwargs)
#             page_count += 1

#             current_groups = [
#                 group["GroupName"] for group in response.get("Groups", [])
#             ]
#             groups.extend(current_groups)

#             pagination_token = response.get("NextToken")
#             if not pagination_token:
#                 break

#         return groups

#     except ClientError as e:
#         error_code = e.response.get("Error", {}).get("Code", "UnknownError")
#         print(f"Error getting user {username} groups. Error code: {error_code}")
#         raise e


# def remove_user_from_group(cognito, username, group_name, user_pool_id):
#     try:
#         cognito.admin_remove_user_from_group(
#             UserPoolId=user_pool_id, Username=username, GroupName=group_name
#         )
#         print(f"Successfully removed user {username} from group {group_name}")
#     except ClientError as e:
#         error_code = e.response.get("Error", {}).get("Code", "UnknownError")
#         print(
#             f"Error removing user {username} from group {group_name}. Error code: {error_code}"  # noqa: E501
#         )
#         raise e


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
    user_attributes = event["request"]["userAttributes"]
    print(f"User attributes {user_attributes}")

    # For federated users, the username will be the "sub" from the IdP
    username = event["request"]["userAttributes"]["sub"]
    # We haven't communicated with IAM's IDP team to enforce this attribute yet, so 
    # we will use 'Users' as default with manual review for other roles.
    # Given our department specific settings, future roles should be instead decided by
    # security group information, and the logic should reside in this lambda function.
    # new_group = event["request"]["userAttributes"].get("custom:chatbot_role")
    new_group = "chatbot_user"
    user_pool_id = event["userPoolId"]

    try:
        # Check if the user attributes are present, indicating a federated user
        if event["request"]["userAttributes"]:
            print(f"Federated User Signed In with attributes: {event['request']['userAttributes']}")
            cognito = boto3.client("cognito-idp")

            # current_groups = get_user_groups(
            #     cognito=cognito, username=username, user_pool_id=user_pool_id
            # )

            # print(f"Current groups: {current_groups}")

            # Extract the custom:isMemberOf attribute and parse it as JSON
            # is_approved_user = "SG_AB_BIDBOT" in json.loads(event['request']['userAttributes']['custom:isMemberOf'])
            # print("Has Security Group? ", is_approved_user)

            # Groups are not exclusive, so we will not remove the user from other groups.
            # for group in current_groups:
            #     if group != new_group:
            #         remove_user_from_group(cognito, username, group, user_pool_id)

            
            add_user_to_group(
                cognito=cognito,
                username=username,
                group_name=new_group,
                user_pool_id=user_pool_id,
            )
    except Exception as error:
        print("Error: ", error)

    # Set the final user status to CONFIRMED
    event['response']['finalUserStatus'] = 'CONFIRMED'
    print("Returning event: ", event)  # Log the event before returning
    return event

    
    
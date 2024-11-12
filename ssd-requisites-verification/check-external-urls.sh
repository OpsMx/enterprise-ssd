#Following URLs are connected from SSD.
#Verify if they are connecting successfully

#Run the commands inside Cluster network/pod, to check if URLs are returning 200 status OK
echo "Note: Empty responses indicates 'Connection Timeout' and it means connectivity is unavailable
#* SAMPLE: START *
#Connectivity unavailable
== https://api.first.org

#Connectivity is good
== https://services.nvd.nist.gov
HTTP/1.1 200 OK
content-length: 0 

#* SAMPLE: END * 
------------------------ "

echo -e "\n== https://api.first.org"
curl --max-time 10 -Is https://api.first.org | head -2

echo -e "\n== https://services.nvd.nist.gov"
curl --max-time 10 -Is https://services.nvd.nist.gov | head -2

echo -e "\n== https://raw.githubusercontent.com"
curl --max-time 10 -Is https://raw.githubusercontent.com | head -2

echo -e "\n== https://api.vulncheck.com"
curl --max-time 10 -Is https://api.vulncheck.com | head -2
echo

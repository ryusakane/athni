"""Short names for NCAA directory institution names (the names rankings and results use)."""
import re
SHORT = {
"Louisiana State University":"LSU","Brigham Young University":"BYU","Texas Christian University":"TCU","Southern Methodist University":"SMU",
"University of Central Florida":"UCF","University of Nevada, Las Vegas":"UNLV","University of Texas at El Paso":"UTEP","University of Texas at San Antonio":"UTSA",
"University of Alabama at Birmingham":"UAB","The University of North Carolina at Greensboro":"UNCG","University of North Carolina Wilmington":"UNCW",
"University of North Carolina Asheville":"UNC Asheville","University of Mississippi":"Ole Miss","North Carolina State University":"North Carolina State",
"Georgia Institute of Technology":"Georgia Tech","Virginia Polytechnic Institute and State University":"Virginia Tech","Pennsylvania State University":"Penn State",
"The Ohio State University":"Ohio State","Texas A&M University, College Station":"Texas A&M","University of California, Berkeley":"Cal",
"University of California, Los Angeles":"UCLA","University of Southern California":"USC","University of California, Davis":"UC Davis",
"University of California, Irvine":"UC Irvine","University of California, Riverside":"UC Riverside","University of California, San Diego":"UC San Diego",
"University of California, Santa Barbara":"UC Santa Barbara","California Polytechnic State University":"Cal Poly","California State University, Bakersfield":"CSU Bakersfield",
"California State University, Fresno":"Fresno State","California State University, Fullerton":"Cal State Fullerton","California State University, Northridge":"CSUN",
"California State University, Sacramento":"Sacramento State","Long Beach State University":"Long Beach State","The University of North Carolina at Charlotte":"Charlotte",
"University of North Carolina, Chapel Hill":"North Carolina","University of Tennessee, Knoxville":"Tennessee","University of Tennessee at Chattanooga":"Chattanooga",
"University of Tennessee at Martin":"UT Martin","University of Texas at Austin":"Texas","University of Texas at Arlington":"UT Arlington",
"The University of Texas Rio Grande Valley":"UTRGV","Texas A&M University-Corpus Christi":"Texas A&M-Corpus Christi","University of Arkansas, Fayetteville":"Arkansas",
"University of Arkansas at Little Rock":"Little Rock","University of Arkansas, Pine Bluff":"Arkansas-Pine Bluff","University of Illinois Urbana-Champaign":"Illinois",
"University of Illinois Chicago":"UIC","Indiana University, Bloomington":"Indiana","Indiana University Indianapolis":"IU Indy","University of Minnesota, Twin Cities":"Minnesota",
"University of Missouri, Columbia":"Missouri","University of Missouri-Kansas City":"Kansas City","University of Nebraska at Omaha":"Omaha","University of Nebraska-Lincoln":"Nebraska",
"University of Nevada, Reno":"Nevada","University of Maryland, College Park":"Maryland","University of Maryland Eastern Shore":"Maryland Eastern Shore",
"University of Hawaii, Manoa":"Hawaii","University of Colorado Boulder":"Colorado","University of Wisconsin-Madison":"Wisconsin","University of Wisconsin-Green Bay":"Green Bay",
"University of South Carolina, Columbia":"South Carolina","University of South Carolina Upstate":"USC Upstate","Rutgers, The State University of New Jersey, New Brunswick":"Rutgers",
"Montana State University-Bozeman":"Montana State","University of Miami (Florida)":"Miami (FL)","Miami University (Ohio)":"Miami (OH)","St. John's University (New York)":"St. John's",
"University of St. Thomas (Minnesota)":"St. Thomas","College of Charleston (South Carolina)":"Charleston","College of the Holy Cross":"Holy Cross","U.S. Air Force Academy":"Air Force",
"U.S. Military Academy":"Army","U.S. Naval Academy":"Navy","University at Albany":"Albany","Columbia University-Barnard College":"Columbia",
"Fairleigh Dickinson University, Metropolitan Campus":"Fairleigh Dickinson","Southern University, Baton Rouge":"Southern","Southern Illinois University at Carbondale":"Southern Illinois",
"Southern Illinois University Edwardsville":"SIUE","The University of Southern Mississippi":"Southern Miss","The University of Tulsa":"Tulsa","Purdue University Fort Wayne":"Purdue Fort Wayne",
"Queens University of Charlotte":"Queens","Saint Mary's College of California":"Saint Mary's","Mount St. Mary's University":"Mount St. Mary's","University of the Incarnate Word":"Incarnate Word",
"University of the Pacific":"Pacific","Tennessee Technological University":"Tennessee Tech","Middle Tennessee State University":"Middle Tennessee","East Tennessee State University":"East Tennessee State",
"Stephen F. Austin State University":"Stephen F. Austin","Sam Houston State University":"Sam Houston","Austin Peay State University":"Austin Peay","Louisiana Tech University":"Louisiana Tech",
"University of Louisiana at Lafayette":"Louisiana","University of Louisiana Monroe":"Louisiana-Monroe","LSU New Orleans":"New Orleans","Florida International University":"FIU",
"Florida Atlantic University":"Florida Atlantic","Florida Gulf Coast University":"Florida Gulf Coast","Virginia Commonwealth University":"VCU","William & Mary":"William & Mary",
"North Carolina A&T State University":"North Carolina A&T","North Carolina Central University":"North Carolina Central","University of Connecticut":"UConn",
"George Washington University":"George Washington","George Mason University":"George Mason","Loyola University Chicago":"Loyola Chicago","Loyola University Maryland":"Loyola Maryland",
"Loyola Marymount University":"Loyola Marymount","University of North Alabama":"North Alabama","Prairie View A&M University":"Prairie View A&M","Alabama A&M University":"Alabama A&M",
"Florida A&M University":"Florida A&M","East Texas A&M University":"East Texas A&M","Wofford College":"Wofford","The Citadel":"The Citadel","Dartmouth College":"Dartmouth",
"Davidson College":"Davidson","Lafayette College":"Lafayette","Presbyterian College":"Presbyterian","Le Moyne College":"Le Moyne","Merrimack College":"Merrimack","Stonehill College":"Stonehill",
"Wagner College":"Wagner","Boston College":"Boston College","Boston University":"Boston University","Bowling Green State University":"Bowling Green","Providence College":"Providence","Seattle University":"Seattle U","University of Pennsylvania":"Penn","Ohio University":"Ohio","University of Southern Indiana":"Southern Indiana","Utah Tech University":"Utah Tech","Utah Valley University":"Utah Valley",
"Western Kentucky University":"Western Kentucky","Saint Joseph's University":"Saint Joseph's","Saint Peter's University":"Saint Peter's","St. Bonaventure University":"St. Bonaventure",
"University of Detroit Mercy":"Detroit Mercy","Houston Christian University":"Houston Christian","California Baptist University":"California Baptist","Grand Canyon University":"Grand Canyon",
"Kennesaw State University":"Kennesaw State","University of San Diego":"San Diego","University of San Francisco":"San Francisco","Gardner-Webb University":"Gardner-Webb",
"Bethune-Cookman University":"Bethune-Cookman","Long Island University":"LIU","Fairfield University":"Fairfield",
}
def short(n):
  if n in SHORT:
    return SHORT[n]
  m=re.match(r'^(?:The )?University of (.+)$',n)
  if m: return m.group(1)
  m=re.match(r'^(.+) University$',n)
  if m: return m.group(1)
  return n
